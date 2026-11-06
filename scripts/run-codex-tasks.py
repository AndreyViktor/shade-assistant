#!/usr/bin/env python3
"""Execute até N tarefas com uma nova sessão de Codex por tarefa.

Run inside the project root, or pass --project-dir. Requires Git + Codex CLI.
No secrets, internet calls or Git mutation are performed by this runner itself.
"""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from pathlib import Path
import re
import shutil
import subprocess
import sys

TASK_ROW = re.compile(r"^\|\s*(T\d{3})\s*\|\s*(TODO|IN_PROGRESS|BLOCKED|DONE|DEFERRED)\s*\|\s*([^|]*)\|", re.M)
TASK_ID = re.compile(r"T\d{3}")


@dataclass(frozen=True)
class Task:
    id: str
    state: str
    dependencies: tuple[str, ...]


def parse_tasks(markdown: str) -> list[Task]:
    return [Task(match.group(1), match.group(2), tuple(TASK_ID.findall(match.group(3))))
            for match in TASK_ROW.finditer(markdown)]


def eligible_task(tasks: list[Task]) -> Task | None:
    status = {item.id: item.state for item in tasks}
    for task in tasks:
        if task.state == "TODO" and all(status.get(dep) == "DONE" for dep in task.dependencies):
            return task
    return None


def check_pending_tasks(tasks: list[Task]) -> None:
    pending = [task.id for task in tasks if task.state in {"IN_PROGRESS", "BLOCKED"}]
    if pending:
        raise RuntimeError(
            f"Há tarefas IN_PROGRESS/BLOCKED ({', '.join(pending)}): "
            "revisar e resolver antes de iniciar outra."
        )


def check_codex_approval_support() -> None:
    result = subprocess.run(["codex", "exec", "--help"], text=True,
                            capture_output=True, check=False)
    if result.returncode or "--approve-for-me" not in result.stdout:
        raise RuntimeError(
            "O runner requer Codex CLI com suporte a --approve-for-me. "
            "Confira codex exec --help e docs/WORKFLOW.md antes de executar. "
            "Nenhuma tarefa foi iniciada; não há fallback sem sandbox."
        )


def git(root: Path, *args: str) -> str:
    proc = subprocess.run(["git", *args], cwd=root, text=True,
                          capture_output=True, check=False)
    if proc.returncode:
        raise RuntimeError(f"git {' '.join(args)} falhou: {proc.stderr.strip()}")
    return proc.stdout.strip()


def check_clean_git(root: Path) -> None:
    if not (root / ".git").exists():
        raise RuntimeError("Inicialize Git e crie o commit base (veja docs/WORKFLOW.md).")
    if git(root, "status", "--porcelain"):
        raise RuntimeError("Há alterações não commitadas: confira git status antes de executar novas tarefas.")
    git(root, "rev-parse", "HEAD")


def make_prompt(task: Task) -> str:
    return f"""Você está em uma NOVA sessão independente do Codex.
    Trabalhe EXCLUSIVAMENTE na tarefa {task.id}. Não inicie outra tarefa nesta sessão.
    Siga AGENTS.md, docs/WORKFLOW.md e docs/ENGINEERING-STANDARDS.md; leia docs/DECISIONS.md,
    docs/PROGRESS.md e a linha/critério de aceite da tarefa {task.id} em docs/TASKS.md.
    Confira git status/log e apenas arquivos técnicos relacionados. Respeite dependências.
    PLANEJAMENTO OBRIGATÓRIO para toda tarefa, inclusive tarefas pequenas:
    antes de alterar código ou testes, elabore um plano específico para {task.id}.
    O plano deve listar objetivo/critério de aceite, etapas de implementação,
    arquivos ou módulos envolvidos, testes/gates e possíveis bloqueios.
    Marque {task.id} IN_PROGRESS e registre esse plano em docs/PROGRESS.md
    ANTES de iniciar a implementação. Mantenha o plano atualizado se o escopo mudar.
    Não espere aprovação do plano para trabalho já autorizado; respeite as
    autorizações humanas exigidas para captura, credenciais, custos e permissões.
    Somente depois de registrar o plano, implemente e execute os testes/gates aplicáveis.
    NÃO marque DONE sem evidências reais. Registre em docs/PROGRESS.md o resumo objetivo,
    comandos/testes e resultados reais, limitações, arquivos, blockers e próximo passo.
    Se os critérios passarem, marque {task.id} DONE em docs/TASKS.md; faça commit local
    contendo as mudanças de código, testes e documentos, com {task.id} no título.
    Esta execução usa workspace-write com --approve-for-me. O diretório .git
    permanece protegido; para git add/commit autorizados, solicite a escalada
    pelo mecanismo de aprovação do Codex quando necessário. A revisão automática
    decide a autorização; não altere permissões, locks ou regras para contorná-la.
    Se a aprovação for negada ou indisponível, registre o motivo e BLOCKED, e pare.
    Nunca faça push, deploy, instalação privilegiada, bypass de sandbox nem habilite
    gastos/chaves sem autorização. Se bloquear, registre BLOCKED e encerre.
    Depois do commit local de {task.id}, ENCERRE: NÃO comece a próxima tarefa.
    """


def run(root: Path, maximum: int, dry_run: bool) -> int:
    task_file = root / "docs/TASKS.md"
    if not task_file.is_file():
        raise RuntimeError(f"docs/TASKS.md não encontrado em {root}")
    if dry_run:
        tasks = parse_tasks(task_file.read_text(encoding="utf-8"))
        check_pending_tasks(tasks)
        task = eligible_task(tasks)
        print(f"Próxima tarefa elegível: {task.id}" if task else "Nenhuma tarefa elegível.")
        return 0

    if not shutil.which("codex"):
        raise RuntimeError("Codex CLI não encontrado no PATH; instale e autentique primeiro.")
    if not shutil.which("git"):
        raise RuntimeError("Git não encontrado no PATH.")
    check_codex_approval_support()
    for index in range(1, maximum + 1):
        check_clean_git(root)
        tasks = parse_tasks(task_file.read_text(encoding="utf-8"))
        check_pending_tasks(tasks)
        task = eligible_task(tasks)
        if task is None:
            print("Nenhuma tarefa TODO elegível. Fim do ciclo.")
            return 0
        print(f"\n[{index}/{maximum}] Nova sessão Codex para {task.id}", flush=True)
        before = git(root, "rev-parse", "HEAD")
        # --approve-for-me selects workspace-write itself; CLI rejects --sandbox alongside it.
        result = subprocess.run(["codex", "exec", "--approve-for-me", "-"],
                                input=make_prompt(task), cwd=root, text=True, check=False)
        if result.returncode:
            raise RuntimeError(f"Codex terminou com erro ({result.returncode}) em {task.id}; confira estado Git.")
        updated_tasks = parse_tasks(task_file.read_text(encoding="utf-8"))
        check_pending_tasks(updated_tasks)
        updated = {t.id: t.state for t in updated_tasks}
        if updated.get(task.id) != "DONE":
            raise RuntimeError(f"{task.id} terminou como {updated.get(task.id)!r}; corrigir ou tratar bloqueio. Parado.")
        after = git(root, "rev-parse", "HEAD")
        if before == after:
            raise RuntimeError(f"{task.id} marcada DONE sem commit. Parado.")
        messages = git(root, "log", "--format=%s", f"{before}..{after}").splitlines()
        if not any(task.id in message for message in messages):
            raise RuntimeError(f"{task.id} não aparece no título de commit. Parado.")
        check_clean_git(root)
        print(f"{task.id}: DONE, commit local {after[:8]} verificado. Contexto encerrado.", flush=True)
    print("Limite de tarefas atingido. Revise os commits antes de continuar.")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--project-dir", type=Path, default=Path(__file__).resolve().parent.parent)
    parser.add_argument("--max-tasks", type=int, default=1)
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    if not 1 <= args.max_tasks <= 35:
        parser.error("--max-tasks deve estar entre 1 e 35")
    try:
        return run(args.project_dir.resolve(), args.max_tasks, args.dry_run)
    except RuntimeError as exc:
        print(f"ERRO: {exc}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
