# Grants API Contract

`GET /api/grants` returns grant summaries for the current workspace.

## Response

```json
{
  "data": [
    {
      "id": "grant-001",
      "title": "Community Health Grant",
      "amount": 25000
    }
  ]
}
```

## Contract Boundary

The API handler, client normalization helper, contract document, targeted unit test, and changelog must move together when the response shape changes.
