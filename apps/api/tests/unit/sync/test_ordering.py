import uuid
from dataclasses import dataclass

from app.modules.sync.core.ordering import topological_order


@dataclass
class _Node:
    id: uuid.UUID
    parent: uuid.UUID | None = None


def _order(nodes: list[_Node]) -> tuple[list[_Node], list[_Node]]:
    return topological_order(nodes, lambda n: n.id, lambda n: n.parent)


def test_child_listed_before_parent_is_reordered() -> None:
    parent = _Node(uuid.uuid4())
    child = _Node(uuid.uuid4(), parent.id)
    ordered, cyclic = _order([child, parent])
    assert ordered == [parent, child]
    assert cyclic == []


def test_parent_outside_batch_is_ignored() -> None:
    child = _Node(uuid.uuid4(), uuid.uuid4())
    assert _order([child]) == ([child], [])


def test_cycles_are_reported() -> None:
    a, b = _Node(uuid.uuid4()), _Node(uuid.uuid4())
    a.parent, b.parent = b.id, a.id
    own = _Node(uuid.uuid4())
    own.parent = own.id
    free = _Node(uuid.uuid4())
    ordered, cyclic = _order([a, own, free, b])
    assert ordered == [free]
    assert cyclic == [a, own, b]


def test_unrelated_records_keep_their_order() -> None:
    nodes = [_Node(uuid.uuid4()) for _ in range(5)]
    assert _order(nodes) == (nodes, [])
