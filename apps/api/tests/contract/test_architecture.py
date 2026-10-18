"""Los controladores solo declaran rutas y delegan: nunca tocan la base de datos."""

import ast
from pathlib import Path

APP_DIR = Path(__file__).resolve().parents[2] / "app"
FORBIDDEN_MODULES = ("sqlalchemy", "app.core.database", "app.db")
ALLOWED_IMPORTS = {("app.db.models.users", "User")}


def _controllers() -> list[Path]:
    return sorted((APP_DIR / "modules").rglob("*_controller.py"))


def _violations(path: Path) -> list[str]:
    tree = ast.parse(path.read_text(encoding="utf-8"))
    problems: list[str] = []
    for node in ast.walk(tree):
        if isinstance(node, ast.Import):
            modules = [(alias.name, None) for alias in node.names]
        elif isinstance(node, ast.ImportFrom) and node.module:
            modules = [(node.module, alias.name) for alias in node.names]
        else:
            continue
        for module, name in modules:
            if (module, name) in ALLOWED_IMPORTS:
                continue
            if module.startswith(FORBIDDEN_MODULES) or name == "AsyncSession":
                problems.append(f"{path.name}: importa {module}.{name or ''}")
            if module.endswith("_repository") or module.endswith(".repositories"):
                problems.append(f"{path.name}: usa un repositorio directamente ({module})")
    return problems


def test_controllers_exist() -> None:
    assert _controllers()


def test_controllers_do_not_access_the_database() -> None:
    problems = [problem for path in _controllers() for problem in _violations(path)]
    assert problems == []
