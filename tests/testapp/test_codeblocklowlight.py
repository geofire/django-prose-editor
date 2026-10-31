# tests/testapp/test_codeblocklowlight.py
from django_prose_editor.config import allowlist_from_extensions, js_from_extensions


def test_codeblocklowlight_js_module():
    assert "django-prose-editor/codeblocklowlight" in js_from_extensions(
        {"CodeBlockLowlight": True}
    )
    assert "django-prose-editor/codeblocklowlight" not in js_from_extensions(
        {"CodeBlock": True}
    )


def test_codeblocklowlight_allowlist():
    config = allowlist_from_extensions({"CodeBlockLowlight": True})
    assert {"pre", "code", "span"} <= config["tags"]
    assert "class" in config["attributes"]["code"]
    assert "class" in config["attributes"]["span"]
