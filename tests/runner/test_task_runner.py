"""Exercise the runner with real temporary Git repositories and simulated Codex."""
import contextlib
import io
from pathlib import Path
import runpy
import subprocess
import tempfile
import unittest
from unittest.mock import patch


ROOT = Path(__file__).resolve().parents[2]
RUNNER = runpy.run_path(str(ROOT / "scripts/run-codex-tasks.py"))
REAL_RUN = subprocess.run


class RunnerTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="meeting-runner-test-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        (self.root / "docs").mkdir()
        self.task_file = self.root / "docs/TASKS.md"
        self.task_file.write_text(
            "| T001 | TODO | — | first | evidence |\n"
            "| T002 | TODO | T001 | second | evidence |\n"
            "| T036 | DEFERRED | T002 | future | evidence |\n"
        )
        self.git("init", "-b", "main")
        self.commit("base")
        self.launches = []
        self.help_output = "--approve-for-me"
        self.help_code = 0

    def git(self, *args):
        result = REAL_RUN(["git", *args], cwd=self.root, text=True,
                          capture_output=True, check=True)
        return result.stdout.strip()

    def commit(self, message):
        self.git("add", ".")
        self.git("-c", "user.name=Runner Test", "-c", "user.email=runner@example.invalid",
                 "-c", "commit.gpgsign=false", "commit", "-m", message)

    def state(self, task, state):
        lines = self.task_file.read_text().splitlines()
        for index, line in enumerate(lines):
            fields = line.split("|")
            if fields[1].strip() == task:
                fields[2] = f" {state} "
                lines[index] = "|".join(fields)
        self.task_file.write_text("\n".join(lines) + "\n")

    def simulate(self, action=None, maximum=1, dry_run=False):
        def execute(args, **kwargs):
            if args == ["codex", "exec", "--help"]:
                return subprocess.CompletedProcess(args, self.help_code, self.help_output, "")
            if args[:2] == ["codex", "exec"]:
                self.launches.append((args, kwargs))
                code = action(len(self.launches)) if action else 0
                return subprocess.CompletedProcess(args, code)
            return REAL_RUN(args, **kwargs)

        with patch("subprocess.run", side_effect=execute), \
                patch("shutil.which", return_value="/test/tool"), \
                contextlib.redirect_stdout(io.StringIO()) as output:
            result = RUNNER["run"](self.root, maximum, dry_run)
        return result, output.getvalue()

    def complete(self, number):
        task = f"T{number:03}"
        self.state(task, "DONE")
        self.commit(f"feat({task}): simulated delivery")
        return 0

    def test_fresh_session_uses_reviewed_approvals_and_requires_commit(self):
        result, _ = self.simulate(self.complete)
        self.assertEqual(result, 0)
        self.assertEqual(len(self.launches), 1)
        command, options = self.launches[0]
        self.assertEqual(command, ["codex", "exec", "--sandbox", "workspace-write",
                                   "--approve-for-me", "-"])
        self.assertEqual(options["cwd"], self.root)
        self.assertIn("solicite a escalada", options["input"])
        self.assertIn("EXCLUSIVAMENTE na tarefa T001", options["input"])
        self.assertEqual(self.git("status", "--porcelain"), "")

    def test_multiple_tasks_use_separate_exec_calls_and_stop_at_limit(self):
        self.simulate(self.complete, maximum=2)
        self.assertEqual(len(self.launches), 2)
        self.assertIn("EXCLUSIVAMENTE na tarefa T002", self.launches[1][1]["input"])

    def test_unsupported_cli_stops_before_any_task(self):
        self.help_output = "--sandbox"
        with self.assertRaisesRegex(RuntimeError, "requer Codex CLI"):
            self.simulate(self.complete)
        self.assertEqual(self.launches, [])

    def test_failed_cli_probe_stops_before_any_task(self):
        self.help_code = 1
        with self.assertRaisesRegex(RuntimeError, "requer Codex CLI"):
            self.simulate(self.complete)
        self.assertEqual(self.launches, [])

    def test_dry_run_does_not_launch_codex_or_change_git(self):
        before = self.git("rev-parse", "HEAD")
        _, output = self.simulate(dry_run=True)
        self.assertIn("T001", output)
        self.assertEqual(self.launches, [])
        self.assertEqual(before, self.git("rev-parse", "HEAD"))
        self.assertEqual(self.git("status", "--porcelain"), "")

    def test_existing_blocked_or_in_progress_tasks_stop_even_dry_run(self):
        for state in ["BLOCKED", "IN_PROGRESS"]:
            with self.subTest(state=state):
                self.state("T001", state)
                self.commit(f"record {state}")
                for dry_run in [False, True]:
                    with self.assertRaisesRegex(RuntimeError, "IN_PROGRESS/BLOCKED"):
                        self.simulate(self.complete, dry_run=dry_run)
                self.assertEqual(self.launches, [])

    def test_dirty_worktree_is_preserved_and_prevents_launch(self):
        (self.root / "user.txt").write_text("keep this")
        with self.assertRaisesRegex(RuntimeError, "alterações não commitadas"):
            self.simulate(self.complete)
        self.assertEqual(self.launches, [])
        self.assertEqual((self.root / "user.txt").read_text(), "keep this")

    def test_codex_error_does_not_start_next_task(self):
        with self.assertRaisesRegex(RuntimeError, "Codex terminou com erro"):
            self.simulate(lambda _: 1, maximum=2)
        self.assertEqual(len(self.launches), 1)

    def test_denied_approval_recorded_as_blocked_stops_sequence(self):
        def blocked(_):
            self.state("T001", "BLOCKED")
            return 0
        with self.assertRaisesRegex(RuntimeError, "IN_PROGRESS/BLOCKED"):
            self.simulate(blocked, maximum=2)
        self.assertEqual(len(self.launches), 1)
        self.assertIn("BLOCKED", self.task_file.read_text())

    def test_done_without_commit_is_rejected(self):
        def no_commit(_):
            self.state("T001", "DONE")
            return 0
        with self.assertRaisesRegex(RuntimeError, "DONE sem commit"):
            self.simulate(no_commit, maximum=2)
        self.assertEqual(len(self.launches), 1)

    def test_commit_without_task_id_is_rejected(self):
        def wrong_commit(_):
            self.state("T001", "DONE")
            self.commit("missing task identifier")
            return 0
        with self.assertRaisesRegex(RuntimeError, "título de commit"):
            self.simulate(wrong_commit)

    def test_dirty_tree_after_valid_commit_is_rejected(self):
        def dirty(number):
            self.complete(number)
            (self.root / "uncommitted.txt").write_text("leftover")
            return 0
        with self.assertRaisesRegex(RuntimeError, "alterações não commitadas"):
            self.simulate(dirty, maximum=2)
        self.assertEqual(len(self.launches), 1)


if __name__ == "__main__":
    unittest.main()
