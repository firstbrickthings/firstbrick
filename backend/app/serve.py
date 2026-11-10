"""Bind to the hosting platform's assigned port (or 8000 locally)."""
import os
import uvicorn


def main():
    port = int(os.environ.get('PORT', '8000'))
    if not 1 <= port <= 65535:
        raise ValueError('PORT must be between 1 and 65535.')
    uvicorn.run('app.main:app', host='0.0.0.0', port=port, access_log=False)


if __name__ == '__main__':
    main()
