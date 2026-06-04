from typing import List, Optional

from sqlalchemy import (
    JSON,
    Boolean,
    Float,
    ForeignKey,
    ForeignKeyConstraint,
    Integer,
    String,
)
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column, relationship


class Base(DeclarativeBase):
    pass


class Project(Base):
    __tablename__ = "projects"

    id: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    done_clean_period: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)

    buckets: Mapped[List["Bucket"]] = relationship(
        "Bucket",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="Bucket.position",
    )
    tasks: Mapped[List["Task"]] = relationship(
        "Task",
        back_populates="project",
        cascade="all, delete-orphan",
        order_by="Task.position",
        overlaps="bucket_ref,tasks",
    )


class Bucket(Base):
    __tablename__ = "buckets"

    project_id: Mapped[str] = mapped_column(String, ForeignKey("projects.id", ondelete="CASCADE"), primary_key=True)
    name: Mapped[str] = mapped_column(String, primary_key=True)
    title: Mapped[str] = mapped_column(String, nullable=False)
    subtitle: Mapped[str] = mapped_column(String, default="", server_default="")
    position: Mapped[float] = mapped_column(Float, nullable=False)
    color: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    layout: Mapped[str] = mapped_column(String, default="list", server_default="list")
    max_tasks: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    is_default: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")

    project: Mapped[Project] = relationship("Project", back_populates="buckets")
    tasks: Mapped[List["Task"]] = relationship(
        "Task",
        back_populates="bucket_ref",
        cascade="all, delete-orphan",
        order_by="Task.position",
        foreign_keys="[Task.project_id, Task.bucket]",
        overlaps="project,tasks",
    )


class Task(Base):
    __tablename__ = "tasks"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    project_id: Mapped[str] = mapped_column(String, nullable=False)
    title: Mapped[str] = mapped_column(String, nullable=False)
    bucket: Mapped[str] = mapped_column(String, nullable=False)
    position: Mapped[float] = mapped_column(Float, nullable=False)
    tags: Mapped[List[str]] = mapped_column(JSON, default=list)
    filename: Mapped[str] = mapped_column(String, nullable=False)
    due_date: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    priority: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    color: Mapped[Optional[str]] = mapped_column(String, nullable=True)
    created_at: Mapped[str] = mapped_column(String, nullable=False)
    updated_at: Mapped[str] = mapped_column(String, nullable=False)

    __table_args__ = (
        ForeignKeyConstraint(
            ["project_id", "bucket"],
            ["buckets.project_id", "buckets.name"],
            ondelete="CASCADE",
        ),
        ForeignKeyConstraint(["project_id"], ["projects.id"], ondelete="CASCADE"),
    )

    project: Mapped[Project] = relationship(
        "Project",
        back_populates="tasks",
        foreign_keys=[project_id],
        overlaps="bucket_ref,tasks",
    )
    bucket_ref: Mapped[Bucket] = relationship(
        "Bucket",
        back_populates="tasks",
        foreign_keys=[project_id, bucket],
        overlaps="project,tasks",
    )
