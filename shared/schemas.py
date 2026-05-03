from __future__ import annotations
from pydantic import BaseModel, Field
from typing import Literal


class FileNode(BaseModel):
    path: str
    language: str
    loc: int


class Edge(BaseModel):
    src: str
    dst: str
    kind: Literal["import", "call", "ref"] = "import"


class DepGraph(BaseModel):
    root: str
    files: list[FileNode]
    edges: list[Edge]
    summary: str = ""
    layers: list[str] = Field(default_factory=list)


class ModuleDoc(BaseModel):
    path: str
    purpose: str
    responsibilities: list[str]
    neighbors: list[str] = Field(default_factory=list)


class ApiEntry(BaseModel):
    path: str
    symbol: str
    kind: Literal["function", "class", "method", "constant"]
    signature: str
    docstring: str = ""
    example: str = ""


class Decision(BaseModel):
    path: str
    summary: str
    commit: str = ""
    pr: str = ""
    date: str = ""


class TaskSpec(BaseModel):
    """Generic envelope content for an agent task."""
    workspace: str
    stage: str
    payload: dict = Field(default_factory=dict)


class RunArtifacts(BaseModel):
    dep_graph: DepGraph | None = None
    modules: list[ModuleDoc] = Field(default_factory=list)
    api: list[ApiEntry] = Field(default_factory=list)
    decisions: list[Decision] = Field(default_factory=list)
    onboarding_md: str = ""
