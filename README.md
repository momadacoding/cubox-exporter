# Cubox Exporter

CLI tool to export your Cubox highlights to JSON.

## Usage

```bash
# Interactive mode (prompts for domain and API key)
npx cubox-export

# Command-line mode
npx cubox-export -k <your-api-key> -d cubox.cc -o highlights.json
```

### Options

| Flag | Description | Default |
|------|-------------|---------|
| `-k, --api-key <key>` | Cubox API key | (interactive prompt) |
| `-d, --domain <domain>` | `cubox.cc` or `cubox.pro` | `cubox.cc` |
| `-o, --output <file>` | Output file path | `cubox-highlights.json` |

### Getting your API key

1. Go to [cubox.cc](https://cubox.cc/web/settings/extensions) or [cubox.pro](https://cubox.pro/web/settings/extensions)
2. Find **Extensions & Automation > API Extension**
3. Generate and copy your API key

## Output format

```json
{
  "exported_at": "2026-05-04T12:00:00.000Z",
  "cubox_domain": "cubox.cc",
  "total_articles": 10,
  "total_highlights": 42,
  "articles": [
    {
      "title": "Article Title",
      "url": "https://example.com/article",
      "domain": "example.com",
      "cubox_url": "https://cubox.cc/...",
      "create_time": "2026-05-01T10:30:00Z",
      "tags": ["tag1", "tag2"],
      "highlights": [
        {
          "text": "Highlighted text",
          "note": "Your annotation",
          "color": "#FFD700",
          "create_time": "2026-05-01T10:35:00Z",
          "cubox_url": "https://cubox.cc/..."
        }
      ]
    }
  ]
}
```

## Development

```bash
npm install
npm run dev       # Run with tsx
npm run build     # Compile to dist/
```

Requires Node.js >= 22.

## License

[MIT](LICENSE)
