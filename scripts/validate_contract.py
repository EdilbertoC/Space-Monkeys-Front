"""Validate OpenAPI, JSON examples and optionally a running backend.

Run with uv run --with openapi-spec-validator --with pyyaml --with jsonschema
python scripts/validate_contract.py [PATH] [--server http://localhost:8000]
"""

import argparse
import json
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.request import urlopen

import yaml
from jsonschema import Draft202012Validator, FormatChecker
from openapi_spec_validator import validate
from referencing import Registry, Resource


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("contract", type=Path, nargs="?", default=Path(__file__).resolve().parents[1] / "contracts" / "openapi.yaml")
    parser.add_argument("--server")
    args = parser.parse_args()
    document = yaml.safe_load(args.contract.read_text(encoding="utf-8"))
    validate(document)
    uri = "urn:space-monkeys:openapi"
    registry = Registry().with_resource(
        uri, Resource.from_contents({"$schema": "https://json-schema.org/draft/2020-12/schema", **document})
    )
    examples = 0
    errors = []
    live_results = []

    def resolve(value):
        if "$ref" not in value:
            return value
        result = document
        for key in value["$ref"].removeprefix("#/").split("/"):
            result = result[key.replace("~1", "/").replace("~0", "~")]
        return resolve(result)

    # Resolve fragment references relative to the complete OpenAPI document.
    def check(schema, value, label):
        wrapped = {"$id": uri, **document, **schema}
        wrapped.pop("$ref", None)
        if "$ref" in schema:
            wrapped["allOf"] = [{"$ref": schema["$ref"]}]
        for error in Draft202012Validator(wrapped, registry=registry, format_checker=FormatChecker()).iter_errors(value):
            errors.append(f"{label}: {list(error.absolute_path)}: {error.message}")

    for route, path in document["paths"].items():
        for method, operation in path.items():
            if method not in ("get", "post", "put", "patch", "delete", "options", "head"):
                continue
            for status, response in operation["responses"].items():
                for media in resolve(response).get("content", {}).values():
                    for name, example in media.get("examples", {}).items():
                        if "value" in example:
                            check(media["schema"], example["value"], f"{route} {status} {name}")
                            examples += 1
                    if "example" in media:
                        check(media["schema"], media["example"], f"{route} {status}")
                        examples += 1
            if args.server and method == "get" and route in ("/health", "/status", "/history/meta", "/fires/live", "/detections/recent"):
                try:
                    with urlopen(args.server.rstrip("/") + route, timeout=5) as response:
                        body = json.load(response)
                        check(operation["responses"]["200"]["content"]["application/json"]["schema"], body, route)
                        live_results.append({"route": route, "status": response.status})
                except (HTTPError, URLError, TimeoutError, OSError, ValueError) as error:
                    live_results.append({"route": route, "error": str(error)})

    print(json.dumps({
        "openapi": document["openapi"], "paths": len(document["paths"]),
        "examples_checked": examples, "schema_errors": errors, "backend": live_results,
    }, ensure_ascii=False, indent=2))
    return 1 if errors or any("error" in result for result in live_results) else 0


if __name__ == "__main__":
    raise SystemExit(main())
