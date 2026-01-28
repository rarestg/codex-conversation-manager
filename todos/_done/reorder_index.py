from pathlib import Path

INDEX_PATH = Path(__file__).with_name('INDEX.txt')

def parse_plan_timestamp(filename: str) -> tuple[int, int, int, int] | None:
    prefix = filename.split('_', 1)[0]
    if prefix.count('-') < 3:
        return None
    date_part, time_part = prefix.rsplit('-', 1)
    try:
        year_str, month_str, day_str = date_part.split('-', 2)
        year = int(year_str)
        month = int(month_str)
        day = int(day_str)
    except ValueError:
        return None

    time_part = time_part.lower()
    if not time_part.endswith(('am', 'pm')):
        return None
    meridiem = time_part[-2:]
    hour_str = time_part[:-2]
    if not hour_str.isdigit():
        return None
    hour = int(hour_str)
    if hour < 1 or hour > 12:
        return None
    if meridiem == 'am':
        hour = 0 if hour == 12 else hour
    else:
        hour = 12 if hour == 12 else hour + 12

    return (year, month, day, hour)

original_text = INDEX_PATH.read_text()
lines = original_text.splitlines()

# Find the "Entries" heading.
entries_index = None
for idx, line in enumerate(lines):
    if line.strip() == 'Entries':
        entries_index = idx
        break
if entries_index is None:
    raise SystemExit('Entries heading not found in INDEX.txt')

# Include an optional underline right after Entries.
underline_index = entries_index + 1
if underline_index < len(lines) and set(lines[underline_index].strip()) == {'='}:
    body_start = underline_index + 1
else:
    body_start = entries_index + 1

header_lines = lines[:body_start]
body_lines = lines[body_start:]

blocks: list[list[str]] = []
current: list[str] = []
for line in body_lines:
    if line.startswith('- Plan: '):
        if current:
            blocks.append(current)
            current = []
        current.append(line)
    else:
        if current:
            current.append(line)
        else:
            # Skip leading blank lines before the first plan block
            if not line.strip():
                continue
if current:
    blocks.append(current)

plan_entries: list[tuple[tuple[int, int, int, int] | None, int, str]] = []
invalid_plans: list[str] = []
original_blocks = [('\n'.join(block).rstrip()) for block in blocks]
for index, block in enumerate(blocks):
    first_line = block[0]
    plan = first_line.split(':', 1)[1].strip()
    timestamp = parse_plan_timestamp(plan)
    if timestamp is None:
        invalid_plans.append(plan)
    plan_entries.append((timestamp, index, '\n'.join(block).rstrip()))

if invalid_plans:
    formatted = '\n'.join(f'- {plan}' for plan in invalid_plans)
    raise SystemExit(
        'Invalid plan filename(s) in todos/_done/INDEX.txt. Expected format '
        '`YYYY-MM-DD-<h>am|pm_<name>` (e.g., `2026-01-28-1pm_example.txt`).\n'
        f'{formatted}'
    )

plan_entries.sort(
    key=lambda entry: (
        -(entry[0][0]) if entry[0] else 0,
        -(entry[0][1]) if entry[0] else 0,
        -(entry[0][2]) if entry[0] else 0,
        -(entry[0][3]) if entry[0] else 0,
        entry[1],
    )
)
ordered_blocks = [entry[2] for entry in plan_entries]

header_text = '\n'.join(header_lines).rstrip()
new_text = header_text + '\n\n' + '\n\n'.join(ordered_blocks) + '\n'
INDEX_PATH.write_text(new_text)

original_entries = [block[2] for block in plan_entries]
if original_text == new_text:
    print('Reorder index: no changes (entries already in order).')
else:
    moved = sum(1 for index, block in enumerate(original_blocks) if ordered_blocks[index] != block)
    print(f'Reorder index: updated order. Sections moved: {moved}.')
