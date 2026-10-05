"""Architecture enforcement tests using pytest-archon.

Guarantees clean CQRS and domain boundaries in Jotter backend.
"""

from pytest_archon import archrule


def test_query_service_does_not_import_disk_repository():
    """Ensure the Read / Query service only talks to SQLite projections and never touches disk."""
    (
        archrule("query-service-reads-only-from-projections")
        .match("jotter.features.tasks.query_service")
        .should_not_import("jotter.features.tasks.disk_repo")
        .check("jotter")
    )


def test_domain_layer_is_pure():
    """Ensure domain entities and value objects never depend on repositories or database drivers."""
    (
        archrule("pure-domain-layer")
        .match("jotter.features.*.domain*")
        .should_not_import(
            "jotter.features.*.sqlite*",
            "jotter.features.*.disk*",
            "jotter.features.*.repo*",
            "jotter.features.*.service*",
            "jotter.features.*.router*",
            "sqlite3",
        )
        .check("jotter")
    )


def test_routers_do_not_import_repositories_directly():
    """Ensure HTTP routers communicate through command/query services and never directly import repositories."""
    (
        archrule("routers-use-application-services")
        .match("jotter.features.*.router")
        .should_not_import("jotter.features.*.sqlite_repo", "jotter.features.*.disk_repo")
        .check("jotter", only_direct_imports=True)
    )


def test_projector_owns_sqlite_task_mutations():
    """Ensure command service uses TaskProjector for SQLite projections and does not directly import SqliteTaskRepository."""
    (
        archrule("command-service-uses-projector")
        .match("jotter.features.tasks.command_service")
        .should_not_import("jotter.features.tasks.sqlite_repo")
        .check("jotter")
    )


def test_shared_kernel_does_not_import_features():
    """Ensure shared kernel components (db, fs, exceptions, ulid, slug) do not depend on features."""
    (
        archrule("pure-shared-kernel")
        .match("jotter.shared.*")
        .should_not_import("jotter.features.*")
        .check("jotter", only_direct_imports=True)
    )
