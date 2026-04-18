<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Источник истины

Спецификация проекта — [SPEC.md](SPEC.md). Это единственный актуальный документ по архитектуре, модерации, rate-limit, данным, UI и дизайну. Если пользователь говорит «по ТЗ» или «по спеке» — имеется в виду SPEC.md.

Краткий внешний обзор для GitHub-аудитории — [README.md](README.md).

# Поддержание документации

При любых изменениях, которые меняют поведение/архитектуру/структуру проекта:
- **SPEC.md** — обновить затронутые разделы так, чтобы документ оставался актуальным и **не копил историю** («было так, стало так» — не нужно; SPEC описывает только текущее состояние).
- **README.md** — обновить, если меняется что-то внешнее: стек, команды запуска, список env, workflow деплоя, ссылка на прод.

Писать естественно, без маркетинг-тона и без поэтического наполнения. Минимум буллет-списков, когда одна-две фразы прозой справляются. Никаких emoji в тексте (кроме отдельно согласованных мест вроде badge в README).
