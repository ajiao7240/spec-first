#!/bin/bash
set -e
set -u

# task-manager.sh - 管理 task.yaml 的创建、读取、更新

create_task() {
    local task_id=$1
    local title=$2
    local role=${3:-generic}
    local level=${4:-L2}

    mkdir -p .claude/tasks/$task_id

    cat > .claude/tasks/$task_id/task.yaml <<EOF
task_id: $task_id
title: $title
role: $role
level: $level
current_stage: brainstorm
status: pending
created_at: $(date -u +"%Y-%m-%dT%H:%M:%S%z")
updated_at: $(date -u +"%Y-%m-%dT%H:%M:%S%z")
EOF
}

read_task() {
    local task_id=$1
    local yaml_file=".claude/tasks/$task_id/task.yaml"

    if [ ! -f "$yaml_file" ]; then
        echo "Error: task.yaml not found" >&2
        return 1
    fi

    cat "$yaml_file"
}

update_task() {
    local task_id=$1
    local stage=$2
    local status=$3
    local yaml_file=".claude/tasks/$task_id/task.yaml"

    if [ ! -f "$yaml_file" ]; then
        echo "Error: task.yaml not found" >&2
        return 1
    fi

    if [ -n "$stage" ]; then
        sed -i '' "s/current_stage: .*/current_stage: $stage/" "$yaml_file"
    fi

    if [ -n "$status" ]; then
        sed -i '' "s/status: .*/status: $status/" "$yaml_file"
    fi

    sed -i '' "s/updated_at: .*/updated_at: $(date -u +"%Y-%m-%dT%H:%M:%S%z")/" "$yaml_file"
}

main() {
    local command=$1
    shift

    case $command in
        create)
            local task_id=""
            local title=""
            local role="generic"
            local level="L2"

            while [[ $# -gt 0 ]]; do
                case $1 in
                    --task-id) task_id="$2"; shift 2 ;;
                    --title) title="$2"; shift 2 ;;
                    --role) role="$2"; shift 2 ;;
                    --level) level="$2"; shift 2 ;;
                    *) echo "Unknown: $1" >&2; exit 1 ;;
                esac
            done

            create_task "$task_id" "$title" "$role" "$level"
            ;;
        read)
            local task_id=""
            while [[ $# -gt 0 ]]; do
                case $1 in
                    --task-id) task_id="$2"; shift 2 ;;
                    *) echo "Unknown: $1" >&2; exit 1 ;;
                esac
            done

            read_task "$task_id"
            ;;
        update)
            local task_id=""
            local stage=""
            local status=""

            while [[ $# -gt 0 ]]; do
                case $1 in
                    --task-id) task_id="$2"; shift 2 ;;
                    --stage) stage="$2"; shift 2 ;;
                    --status) status="$2"; shift 2 ;;
                    *) echo "Unknown: $1" >&2; exit 1 ;;
                esac
            done

            update_task "$task_id" "$stage" "$status"
            ;;
        *)
            echo "Usage: $0 {create|read|update}" >&2
            exit 1
            ;;
    esac
}

main "$@"
