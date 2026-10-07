#!/usr/bin/env sh
set -eu

SCRIPT_DIR=$(CDPATH= cd "$(dirname "$0")" && pwd)
ENV_FILE="$SCRIPT_DIR/.env"
ENV_EXAMPLE_FILE="$SCRIPT_DIR/.env.example"
CREDENTIAL_INSTRUCTION='Set non-empty POSTGRES_PASSWORD and RABBITMQ_PASSWORD in .env, then rerun this script.'

if [ ! -f "$ENV_FILE" ]; then
  cp "$ENV_EXAMPLE_FILE" "$ENV_FILE"
  echo "$CREDENTIAL_INSTRUCTION" >&2
  exit 1
fi

get_env_value() {
  value=$(awk -v key="$1" '
    $0 ~ "^[[:space:]]*" key "[[:space:]]*=" {
      sub("^[[:space:]]*" key "[[:space:]]*=", "")
      print
      exit
    }
  ' "$ENV_FILE" | sed 's/^[[:space:]]*//;s/[[:space:]]*$//')
  value=${value#\"}
  value=${value%\"}
  value=${value#\'}
  value=${value%\'}
  printf '%s' "$value"
}

invalid_credential() {
  value=$1
  [ -z "$value" ] && return 0
  normalized=$(printf '%s' "$value" | tr '[:upper:]' '[:lower:]')
  case "$normalized" in
    *placeholder*|*changeme*|*change-me*|*change_me*|*replace-with-*|*replace_with_*|*example*|*your-*) return 0 ;;
    *) return 1 ;;
  esac
}

postgres_password=$(get_env_value POSTGRES_PASSWORD)
rabbitmq_password=$(get_env_value RABBITMQ_PASSWORD)
if invalid_credential "$postgres_password" || invalid_credential "$rabbitmq_password"; then
  echo "$CREDENTIAL_INSTRUCTION" >&2
  exit 1
fi

rabbitmq_management_port=$(get_env_value RABBITMQ_MANAGEMENT_PORT)
rabbitmq_management_port=${rabbitmq_management_port:-15672}

if ! command -v docker >/dev/null 2>&1; then
  echo "Docker is required but was not found in PATH." >&2
  exit 1
fi

docker info >/dev/null
docker compose version >/dev/null
docker compose --project-directory "$SCRIPT_DIR" --env-file "$ENV_FILE" pull
docker compose --project-directory "$SCRIPT_DIR" --env-file "$ENV_FILE" up --no-build -d --wait --wait-timeout 240

printf '%s\n' \
  'PayGrid is ready:' \
  '  PayGrid:   http://localhost:8080' \
  '  API:       http://localhost:3000/orders' \
  '  API docs:  http://localhost:3000/docs'
printf '  RabbitMQ:  http://localhost:%s (local host only)\n' "$rabbitmq_management_port"
