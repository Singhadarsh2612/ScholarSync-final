"""python -m observability.status — report what tracing is configured."""

from . import config, tracing


def main():
    info = config.summary()
    print("Observability\n" + "-" * 52)
    print(f"  tracing         : {'ON' if info['enabled'] else 'OFF'}")
    print(f"  key source      : {info['key_source'] or '(no key set)'}")
    print(f"  project         : {info['project'] or '-'}")
    print(f"  capture content : {info['capture_content']}")
    print(f"  max field chars : {info['max_field_chars']}")

    if not info["enabled"]:
        print("\n  Set LANGSMITH_API_KEY in .env to enable. Until then every")
        print("  decorator is a pass-through and nothing is uploaded.")
        return

    tracing.init()
    try:
        from langsmith import Client
        projects = list(Client().list_projects(limit=1))
        print(f"\n  API reachable   : yes ({len(projects)} project(s) visible)")
    except Exception as exc:
        print(f"\n  API reachable   : NO -- {type(exc).__name__}: {str(exc)[:120]}")


if __name__ == "__main__":
    main()
