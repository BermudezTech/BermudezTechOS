"""Orden de registros con autorreferencia dentro de un lote (subcuentas, renovaciones de CDT)."""

import uuid
from collections.abc import Callable


def topological_order[T](
    items: list[T],
    key: Callable[[T], uuid.UUID],
    parent: Callable[[T], uuid.UUID | None],
) -> tuple[list[T], list[T]]:
    """Devuelve `(ordenados, en_ciclo)`: cada padre presente en el lote va antes que sus hijos.

    Los padres que no vienen en el lote se ignoran (se resuelven luego contra la base). El orden
    relativo de los registros sin relación se conserva.
    """
    keys = {key(item) for item in items}
    placed: set[uuid.UUID] = set()
    ordered: list[T] = []
    pending = list(items)
    progress = True
    while pending and progress:
        progress = False
        waiting: list[T] = []
        for item in pending:
            target = parent(item)
            if target is None or target not in keys or target in placed:
                ordered.append(item)
                placed.add(key(item))
                progress = True
            else:
                waiting.append(item)
        pending = waiting
    return ordered, pending
