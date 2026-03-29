#!/bin/bash
set -e
set -u

# stage-gate.sh - 阶段契约检查

check_file_exists() {
    local file=$1
    if [ ! -f "$file" ]; then
        echo "Error: $file not found" >&2
        return 1
    fi
    if [ ! -s "$file" ]; then
        echo "Error: $file is empty" >&2
        return 1
    fi
}

check_review_passed() {
    local review_file=$1
    local pass=$(grep "^pass:" "$review_file" | cut -d' ' -f2)

    if [ "$pass" != "true" ]; then
        echo "Error: review not passed" >&2
        return 1
    fi
}

check_stage_gate() {
    local task_id=$1
    local stage=$2
    local task_dir=".claude/tasks/$task_id"

    case $stage in
        brainstorm)
            return 0
            ;;
        plan)
            check_file_exists "$task_dir/01-brainstorm.md"
            ;;
        work)
            check_file_exists "$task_dir/02-plan.md"
            ;;
        review)
            check_file_exists "$task_dir/03-work.md"
            ;;
        compound)
            check_file_exists "$task_dir/04-review.md"
            check_review_passed "$task_dir/04-review.md"
            ;;
        *)
            echo "Error: unknown stage $stage" >&2
            return 1
            ;;
    esac
}

main() {
    local task_id=""
    local stage=""

    while [[ $# -gt 0 ]]; do
        case $1 in
            check) shift ;;
            --task-id) task_id="$2"; shift 2 ;;
            --stage) stage="$2"; shift 2 ;;
            *) echo "Unknown: $1" >&2; exit 1 ;;
        esac
    done

    check_stage_gate "$task_id" "$stage"
}

main "$@"
