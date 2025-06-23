# HTTP Server using OAS

A routing bridge module that connects OpenAPI Specification (OAS) definitions with the `@superhero/http-server`, enabling automatic route creation, request validation, and response conformance. Designed for the Superhero Tool-Chain, this module allows for fully declarative HTTP APIs, grounded in specification adapted architecture.

## Features

- **Specification driven routing**: Dynamically registers routes from OpenAPI JSON specifications.
- **Schema validation**: Automatically validates parameters, request bodies, and responses.
- **Component reference resolution**: Supports `$ref` linking across parameters, request bodies, responses, and schemas.
- **Dynamic middleware injection**: Adds validation middleware as required by the specifications.
- **Declarative dispatcher mapping**: Connects OAS operations directly to logic handlers.
- **Robust error handling**: Emits structured errors for invalid config or unsupported content types.

## Installation

```bash
npm install @superhero/http-server-using-oas
```

## Usage

You must supply an **OpenAPI 3.x Specification as a JSON object** in the `oas` configuration field.

```javascript
import Core from '@superhero/core'

const core = new Core()

await core.add('@superhero/oas')
await core.add('@superhero/http-server')
await core.add('@superhero/http-server-using-oas')

core.locate.config.assign({
  oas: {
    paths: {
      "/foo": {
        "get":  { "responses": { "200": {} }},
        "post": { "responses": { "200": {} }}
      }
    }
  }
})

await core.bootstrap()

const oasBridge = core.locate('@superhero/http-server-using-oas')

oasBridge.setOasRoute('/foo', 'get',  'dispatcher/for/get')
oasBridge.setOasRoute('/foo', 'post', 'dispatcher/for/post')
```

## Automatic Middleware Injection

Depending on the OAS operation, the following are automatically injected:

- `@superhero/http-server-using-oas/dispatcher/upstream/parameters`
- `@superhero/http-server-using-oas/dispatcher/upstream/request-bodies`
- `@superhero/http-server-using-oas/dispatcher/downstream/responses`

Supported `requestBody.content-type`:  
- Only `application/json` is currently supported

## More Complete OAS Example

This module resolves `$ref`-based components in OpenAPI JSON specifications:

```json
{
  "paths": {
    "/example": {
      "post": {
        "requestBody": {
          "$ref": "#/components/requestBodies/ExampleRequestBody"
        },
        "responses": {
          "200": {
            "$ref": "#/components/responses/SuccessResult"
          }
        }
      }
    }
  },
  "components": {
    "requestBodies": {
      "ExampleRequestBody": {
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Foo"
            }
          }
        }
      }
    },
    "responses": {
      "SuccessResult": {
        "description": "Successful result",
        "content": {
          "application/json": {
            "schema": {
              "$ref": "#/components/schemas/Result"
            }
          }
        }
      }
    },
    "schemas": {
      "Foo": {
        "type": "object",
        "properties": {
          "foo": { "type": "string" }
        }
      },
      "Result": {
        "type": "object",
        "properties": {
          "result": { "type": "string" }
        }
      }
    }
  }
}
```

## Configuration Summary

| Method/Property                                        | Description                                                           |
|--------------------------------------------------------|-----------------------------------------------------------------------|
| `setOasRoute(path, method, dispatcher, [middlewares])` | Registers a route from the OpenAPI JSON spec                          |
| `requestBodyContentTypeRouteMap(type)`                 | Maps supported content-types to upstream middleware                   |
| Middleware auto-injection                              | Based on the `parameters`, `requestBody`, and `responses` in the spec |
| Error signaling                                        | Emits detailed errors on spec validation or misuse                    |

## Tests

Run the test suite:

```bash
npm test
```

### Test Coverage

```
────────────────────────────────── ⋅⋆ Suite ⋆⋅ ─────────────────────────────────

@superhero/http-server-using-oas 
├─ Can set a simple specification ✔ 107.543ms
├─ Can add middleware for requestBody content ✔ 16.743ms
├─ Can add middleware for parameters ✔ 19.857ms
├─ Specification with reference to components 
│  ├─ GET method using default parameter query parameter ✔ 37.413ms
│  ├─ GET method not using required parameter ✔ 9.606ms
│  ├─ GET method using bar parameter ✔ 5.497ms
│  ├─ GET method using header parameter ✔ 4.792ms
│  ├─ POST method using request body ✔ 11.069ms
│  └─ ✔ 91.067ms
└─ ✔ 238.450ms

─────────────────────────────────── Coverage ───────────────────────────────────

Files                                            Coverage   Functions   Branches
dispatcher/downstream/responses.js                    69%         75%        80%
dispatcher/options.js                                 10%         33%       100%
dispatcher/upstream/parameters.js                    100%        100%       100%
dispatcher/upstream/request-bodies.js                 75%         75%       100%
index.js                                              82%        100%        58%
index.test.js                                        100%        100%       100%
Total                                                 68%         88%        83%
```

## License

MIT

## Contributing

Issues and pull requests are welcome.
