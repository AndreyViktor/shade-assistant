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

    def simulate(self, action=None, maximum=1, dry_run=False, selected=None):
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
            result = RUNNER["run"](self.root, maximum, dry_run, selected)
        return result, output.getvalue()

    def complete(self, number):
        task = f"T{number:03}"
        self.state(task, "DONE")
        self.commit(f"feat({task}): simulated delivery")
        return 0

    def add_independent_chain(self):
        with self.task_file.open("a") as file:
            file.write("| T040 | TODO | — | target | evidence |\n"
                       "| T041 | TODO | T040 | next | evidence |\n")
        self.commit("add independent chain")

    def complete_selected(self, number):
        task = ["T040", "T041"][number - 1]
        self.state(task, "DONE")
        self.commit(f"feat({task}): simulated delivery")
        return 0

    def test_selected_chain_skips_other_eligible_tasks_and_uses_separate_sessions(self):
        self.add_independent_chain()
        _, output = self.simulate(self.complete_selected, maximum=2, selected=["T040", "T041"])
        self.assertEqual(len(self.launches), 2)
        self.assertIn("EXCLUSIVAMENTE na tarefa T040", self.launches[0][1]["input"])
        self.assertIn("EXCLUSIVAMENTE na tarefa T041", self.launches[1][1]["input"])
        self.assertIn("T041: DONE", output)
        self.assertIn("| T001 | TODO |", self.task_file.read_text())
        self.assertEqual(self.git("status", "--porcelain"), "")

    def test_selected_dry_run_prevalidates_chain_without_launch(self):
        self.add_independent_chain()
        before = self.git("rev-parse", "HEAD")
        _, output = self.simulate(maximum=2, dry_run=True, selected=["T040", "T041"])
        self.assertIn("Sequência selecionada: T040, T041", output)
        self.assertEqual(self.launches, [])
        self.assertEqual(before, self.git("rev-parse", "HEAD"))

    def test_selection_rejects_invalid_unknown_duplicate_and_out_of_order_before_launch(self):
        self.add_independent_chain()
        for selected in [[], ["T040", "T040"], ["T999"], ["bad"], ["T041"], ["T041", "T040"], ["T036"], ["T040", "T999"]]:
            with self.subTest(selected=selected):
                for dry_run in [True, False]:
                    with self.assertRaises(RuntimeError):
                        self.simulate(maximum=2, dry_run=dry_run, selected=selected)
                self.assertEqual(self.launches, [])

    def test_selection_respects_unrelated_blocked_or_in_progress_task(self):
        self.add_independent_chain()
        for state in ["BLOCKED", "IN_PROGRESS"]:
            self.state("T001", state)
            self.commit(f"record {state}")
            for dry_run in [False, True]:
                with self.assertRaisesRegex(RuntimeError, "IN_PROGRESS/BLOCKED"):
                    self.simulate(maximum=2, dry_run=dry_run, selected=["T040", "T041"])
            self.assertEqual(self.launches, [])

    def test_selection_stops_on_failure_and_respects_maximum(self):
        self.add_independent_chain()
        with self.assertRaisesRegex(RuntimeError, "Codex terminou com erro"):
            self.simulate(lambda _: 1, maximum=2, selected=["T040", "T041"])
        self.assertEqual(len(self.launches), 1)
        self.launches.clear()
        self.simulate(self.complete_selected, maximum=1, selected=["T040", "T041"])
        self.assertEqual(len(self.launches), 1)
        self.assertIn("| T041 | TODO |", self.task_file.read_text())

    def test_selection_rechecks_real_completion_before_next_task(self):
        self.add_independent_chain()
        def missing_commit(_):
            self.state("T040", "DONE")
            return 0
        with self.assertRaisesRegex(RuntimeError, "DONE sem commit"):
            self.simulate(missing_commit, maximum=2, selected=["T040", "T041"])
        self.assertEqual(len(self.launches), 1)

    def test_cli_defaults_to_whole_explicit_list_but_default_automatic_stays_one(self):
        self.add_independent_chain()
        calls = []
        runner_globals = RUNNER["main"].__globals__
        with patch.dict(runner_globals, {"run": lambda *args: calls.append(args) or 0}):
            with patch("sys.argv", ["runner", "--tasks", "T040", "T041", "--dry-run"]):
                self.assertEqual(RUNNER["main"](), 0)
            with patch("sys.argv", ["runner", "--dry-run"]):
                self.assertEqual(RUNNER["main"](), 0)
        self.assertEqual(calls[0][1:], (2, True, ["T040", "T041"]))
        self.assertEqual(calls[1][1:], (1, True, None))

    def test_fresh_session_uses_reviewed_approvals_and_requires_commit(self):
        result, _ = self.simulate(self.complete)
        self.assertEqual(result, 0)
        self.assertEqual(len(self.launches), 1)
        command, options = self.launches[0]
        self.assertEqual(command, ["codex", "exec", "--approve-for-me", "-"])
        self.assertEqual(options["cwd"], self.root)
        self.assertIn("solicite a escalada", options["input"])
        self.assertIn("EXCLUSIVAMENTE na tarefa T001", options["input"])
        self.assertEqual(self.git("status", "--porcelain"), "")

    def test_multiple_tasks_use_separate_exec_calls_and_stop_at_limit(self):
        self.simulate(self.complete, maximum=2)
        self.assertEqual(len(self.launches), 2)
        self.assertIn("EXCLUSIVAMENTE na tarefa T002", self.launches[1][1]["input"])
        for number, (_, options) in enumerate(self.launches, start=1):
            with self.subTest(task=number):
                prompt = options["input"]
                self.assertIn("PLANEJAMENTO OBRIGATÓRIO para toda tarefa", prompt)
                self.assertIn(f"elabore um plano específico para T{number:03}", prompt)
                self.assertIn("objetivo/critério de aceite, etapas de implementação", prompt)
                self.assertIn("arquivos ou módulos envolvidos, testes/gates e possíveis bloqueios", prompt)
                self.assertIn("registre esse plano em docs/PROGRESS.md", prompt)
                self.assertLess(prompt.index("registre esse plano"),
                                prompt.index("Somente depois de registrar o plano, implemente"))
                self.assertIn("Não espere aprovação do plano para trabalho já autorizado", prompt)

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
