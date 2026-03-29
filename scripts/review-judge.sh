#!/bin/bash
set -e
set -u

# review-judge.sh - Review 双重判定

judge_review() {
    local correctness=$1
    local completeness=$2
    local executability=$3
    local reusability=$4
    local blocking_issues=$5

    # 规则1：关键维度底线
    if [ $correctness -lt 3 ] || [ $completeness -lt 3 ]; then
        echo "pass: false"
        echo "reason: 关键维度低于底线"
        return 1
    fi

    # 规则2：阻断问题优先
    if [ $blocking_issues -gt 0 ]; then
        echo "pass: false"
        echo "reason: 存在阻断问题"
        return 1
    fi

    # 规则3：总分参考
    local total=$((correctness + completeness + executability + reusability))

    if [ $total -lt 12 ]; then
        echo "pass: false"
        echo "reason: 总分过低"
        return 1
    elif [ $total -ge 16 ]; then
        echo "pass: true"
        echo "compound_recommended: true"
        return 0
    else
        echo "pass: true"
        echo "compound_recommended: false"
        return 0
    fi
}

main() {
    local correctness=0
    local completeness=0
    local executability=0
    local reusability=0
    local blocking=0

    while [[ $# -gt 0 ]]; do
        case $1 in
            judge) shift ;;
            --correctness) correctness="$2"; shift 2 ;;
            --completeness) completeness="$2"; shift 2 ;;
            --executability) executability="$2"; shift 2 ;;
            --reusability) reusability="$2"; shift 2 ;;
            --blocking) blocking="$2"; shift 2 ;;
            *) echo "Unknown: $1" >&2; exit 1 ;;
        esac
    done

    judge_review "$correctness" "$completeness" "$executability" "$reusability" "$blocking"
}

main "$@"
