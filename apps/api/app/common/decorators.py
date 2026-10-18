"""Decoradores de rutas, al estilo de NestJS."""

from collections.abc import Callable
from typing import Any


def public[F: Callable[..., Any]](fn: F) -> F:
    """Marca una ruta como pública: el guard global no exige sesión (`@Public()` de NestJS).

    Debe ir debajo del decorador de la ruta (`@router.post(...)`), para marcar la función antes
    de registrarla.
    """
    fn.__public__ = True  # type: ignore[attr-defined]
    return fn


def is_public(endpoint: object) -> bool:
    return getattr(endpoint, "__public__", False) is True
