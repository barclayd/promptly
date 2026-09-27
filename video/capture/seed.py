"""Seed a clean local demo workspace (Acme AI) for capturing showreel UI states.

Local dev only: run `python3 seed.py > seed.sql && bunx wrangler d1 execute promptly --local --file seed.sql`.
"""
import json
import random
import string

ORG = '109p05TqPMKpD2B8Qhxjmn4RT9I1hF6X'
USER = 'C1SCtrjt0WyOD9tFW7aCKluGUDLjmfjS'
NOW = 1790530728543
DAY = 86_400_000
random.seed(7)


def nid(n=21):
    return ''.join(random.choice(string.ascii_letters + string.digits + '_-') for _ in range(n))


def q(v):
    if v is None:
        return 'NULL'
    if isinstance(v, (int, float)):
        return str(v)
    return "'" + str(v).replace("'", "''") + "'"


out = []


def ins(table, row):
    cols = ', '.join(row)
    vals = ', '.join(q(v) for v in row.values())
    out.append(f'INSERT INTO {table} ({cols}) VALUES ({vals});')


def field(name, type_='string', **params):
    return {'id': nid(), 'name': name, 'type': type_, 'validations': [], 'params': params}


# ---------- folders ----------
folders = {}
for name in ['E-commerce', 'Marketing', 'Customer Support']:
    folders[name] = nid()
    ins('prompt_folder', {'id': folders[name], 'name': name, 'organization_id': ORG, 'created_by': USER, 'created_at': NOW - 20 * DAY, 'updated_at': NOW - 20 * DAY})
out.append(f"DELETE FROM prompt_folder WHERE organization_id = '{ORG}' AND name = 'Untitled';")
out.append(f"UPDATE prompt SET folder_id = '{folders['E-commerce']}', created_at = {NOW - 14 * DAY} WHERE id = 'JdQnEkoz86BHapdUtZg4o';")

# ---------- snippets ----------
snippets = [
    ('Brand Voice', 'How Acme sounds, everywhere.', 'Write like Acme: warm, confident and plain-spoken. Use short sentences, active verbs and concrete detail. Avoid jargon, hype and exclamation marks.'),
    ('Safety Guardrails', 'Rules every customer-facing prompt must follow.', 'Never invent specifications, prices or certifications. If information is missing, say so plainly. Do not make medical, legal or financial claims.'),
    ('SEO Checklist', 'Search best practice for product copy.', 'Use the primary keyword in the first sentence. Keep meta descriptions under 155 characters. Prefer descriptive, scannable headings.'),
    ('Output Formatting', 'Consistent structure for downstream parsing.', 'Return clean Markdown. Use a single H2 for the title, short paragraphs and bullet lists for features.'),
]
snippet_ids = {}
# List pages only show items that live in a folder; 'Untitled' is the default bucket.
SNIP_FOLDER, COMP_FOLDER = nid(), nid()
ins('snippet_folder', {'id': SNIP_FOLDER, 'name': 'Untitled', 'organization_id': ORG, 'created_by': USER, 'created_at': NOW - 30 * DAY, 'updated_at': NOW - 30 * DAY})
ins('composer_folder', {'id': COMP_FOLDER, 'name': 'Untitled', 'organization_id': ORG, 'created_by': USER, 'created_at': NOW - 30 * DAY, 'updated_at': NOW - 30 * DAY})
for i, (name, desc, content) in enumerate(snippets):
    sid = nid()
    snippet_ids[name] = sid
    t = NOW - (18 - i) * DAY
    ins('snippet', {'id': sid, 'name': name, 'description': desc, 'folder_id': SNIP_FOLDER, 'organization_id': ORG, 'created_by': USER, 'created_at': t, 'updated_at': t})
    ins('snippet_version', {'id': nid(), 'snippet_id': sid, 'major': 1, 'minor': 0, 'patch': 0, 'content': content, 'config': '{}', 'created_by': USER, 'created_at': t, 'updated_at': t, 'published_at': t, 'published_by': USER})

# ---------- main prompt: Product Description Writer ----------
MAIN = 'JdQnEkoz86BHapdUtZg4o'
main_schema = [
    field('product_name', description='Name of the product'),
    field('features', 'array', elementType='string', description='Key product features'),
    field('audience', description='Who the copy is for'),
    field('tone', 'enum', values=['friendly', 'premium', 'playful'], description='Voice of the copy'),
]
main_input = {
    'product_name': 'Aurora Smart Desk Lamp',
    'features': ['Adaptive brightness that follows daylight', 'Wireless charging base', '40,000-hour LED'],
    'audience': 'Remote workers',
    'tone': 'premium',
}
user_msg = 'Write a product description for ${product_name}.\nKey features: ${features}\nTarget audience: ${audience}\nTone: ${tone}'
sys_v1 = "You are Acme's senior e-commerce copywriter.\nTurn raw product specs into compelling, accurate product pages that convert."
sys_v2 = sys_v1 + '\nLead with the customer benefit, then back it up with specifics.\nKeep the description under 120 words.'
cfg_v1 = {'schema': main_schema, 'model': 'claude-haiku-4.5', 'temperature': 0.5, 'inputData': main_input, 'inputDataRootName': None}
cfg_v2 = {**cfg_v1, 'model': 'claude-sonnet-4.6', 'temperature': 0.7}
out.append(f"DELETE FROM prompt_version WHERE prompt_id = '{MAIN}';")
main_versions = {}
for (maj, minor, sysm, cfg, days, label) in [
    (1, 0, sys_v1, cfg_v1, 12, None),
    (1, 1, sys_v2, cfg_v2, 5, 'production'),
]:
    vid = nid()
    main_versions[(maj, minor)] = vid
    t = NOW - days * DAY
    ins('prompt_version', {'id': vid, 'prompt_id': MAIN, 'major': maj, 'minor': minor, 'patch': 0, 'system_message': sysm, 'user_message': user_msg, 'config': json.dumps(cfg), 'labels': label, 'created_by': USER, 'created_at': t, 'published_at': t, 'updated_at': t, 'updated_by': USER, 'published_by': USER, 'last_output_tokens': 212, 'last_system_input_tokens': 96, 'last_user_input_tokens': 64})
# draft that equals v1.1 (edited live on camera later)
draft_id = nid()
ins('prompt_version', {'id': draft_id, 'prompt_id': MAIN, 'system_message': sys_v2, 'user_message': user_msg, 'config': json.dumps(cfg_v2), 'created_by': USER, 'created_at': NOW - 1 * DAY, 'updated_at': NOW - 1 * DAY, 'updated_by': USER})
for i, name in enumerate(['Brand Voice', 'Safety Guardrails']):
    for vid in [main_versions[(1, 1)], draft_id]:
        ins('prompt_version_snippet', {'id': nid(), 'prompt_version_id': vid, 'snippet_id': snippet_ids[name], 'auto_update': 1, 'created_at': NOW - 5 * DAY, 'sort_order': i})

# ---------- supporting prompts ----------
other_prompts = [
    ('Launch Email Writer', 'Announcement emails for new product drops.', 'Marketing',
     "You are Acme's lifecycle marketer. Write concise launch emails with a clear subject line, one hero benefit and a single call to action.",
     'Write a launch email for ${product_name}, available ${launch_date}.\nHighlight: ${features}\nAudience: ${audience}',
     [field('product_name'), field('launch_date'), field('features', 'array', elementType='string'), field('audience')]),
    ('Social Post Generator', 'Three platform-ready posts from one brief.', 'Marketing',
     "You write scroll-stopping social posts for Acme. Keep each post under 280 characters and end with a relevant hashtag.",
     'Write three social posts announcing ${product_name} to ${audience}. Mention one of: ${features}',
     [field('product_name'), field('features', 'array', elementType='string'), field('audience')]),
    ('Support Reply Assistant', 'Empathetic first responses for the help desk.', 'Customer Support',
     'You are a friendly Acme support specialist. Acknowledge the issue, give clear next steps and keep replies under 150 words.',
     'Customer ${customer_name} wrote:\n${message}\nOrder status: ${order_status}',
     [field('customer_name'), field('message'), field('order_status')]),
    ('Review Summarizer', 'Turns hundreds of reviews into themes.', 'Customer Support',
     'Summarise customer reviews into the top three positive and negative themes with representative quotes.',
     'Reviews for ${product_name}:\n${reviews}',
     [field('product_name'), field('reviews', 'array', elementType='string')]),
    ('SEO Meta Generator', 'Titles and meta descriptions that rank.', 'E-commerce',
     'Generate an SEO title (max 60 characters) and meta description (max 155 characters).',
     'Product: ${product_name}\nPrimary keyword: ${keyword}',
     [field('product_name'), field('keyword')]),
    ('Churn Risk Classifier', 'Flags at-risk accounts from ticket history.', 'Customer Support',
     'Classify churn risk as low, medium or high and explain the top signal in one sentence.',
     'Account: ${account_name}\nRecent tickets: ${tickets}',
     [field('account_name'), field('tickets', 'array', elementType='string')]),
    ('Onboarding Email Sequence', 'A five-step welcome journey.', 'Marketing',
     'Draft a five-email onboarding sequence that gets new customers to their first win within a week.',
     'Product: ${product_name}\nFirst win: ${activation_goal}',
     [field('product_name'), field('activation_goal')]),
]
prompt_ids = {'Product Description Writer': MAIN}
prompt_latest = {MAIN: main_versions[(1, 1)]}
launch_input = {'product_name': 'Aurora Smart Desk Lamp', 'launch_date': 'October 14', 'features': main_input['features'], 'audience': 'Remote workers'}
for i, (name, desc, folder, sysm, userm, schema) in enumerate(other_prompts):
    pid = nid()
    prompt_ids[name] = pid
    t = NOW - (16 - i * 2) * DAY
    ins('prompt', {'id': pid, 'name': name, 'description': desc, 'folder_id': folders[folder], 'organization_id': ORG, 'created_by': USER, 'created_at': t, 'updated_at': t})
    inp = {f['name']: launch_input.get(f['name'], '') for f in schema}
    cfg = {'schema': schema, 'model': 'claude-haiku-4.5', 'temperature': 0.6, 'inputData': inp, 'inputDataRootName': None}
    vid = nid()
    prompt_latest[pid] = vid
    ins('prompt_version', {'id': vid, 'prompt_id': pid, 'major': 1, 'minor': 0, 'patch': 0, 'system_message': sysm, 'user_message': userm, 'config': json.dumps(cfg), 'created_by': USER, 'created_at': t, 'published_at': t, 'updated_at': t, 'updated_by': USER, 'published_by': USER})

# ---------- composers ----------
composer_schema = [
    field('product_name'), field('launch_date'),
    field('features', 'array', elementType='string'), field('audience'),
]
cs = {f['name']: f for f in composer_schema}


def var(name):
    return f'<span data-field-id="{cs[name]["id"]}" data-field-path="{name}" data-variable-ref=""></span>'


def pref(name):
    return f'<span data-prompt-id="{prompt_ids[name]}" data-prompt-name="{name}" data-prompt-ref=""></span>'


kit_html = (
    f'<h1>Launch kit: {var("product_name")}</h1>'
    f'<p>Everything the team needs for launch day on {var("launch_date")}.</p>'
    f'<h2>Product page</h2><p>{pref("Product Description Writer")}</p>'
    f'<h2>Launch email</h2><p>{pref("Launch Email Writer")}</p>'
    f'<h2>Social posts</h2><p>{pref("Social Post Generator")}</p>'
)
composers = [
    ('Product Launch Kit', 'Page copy, email and socials for every launch.', kit_html, composer_schema, launch_input),
    ('Weekly Support Digest', 'Review themes and churn signals for Monday stand-up.', '<h1>Support digest</h1><p>' + '</p>', [], {}),
    ('Blog Post Builder', 'Outline, draft and SEO meta in one pass.', '<h1>Blog post</h1><p></p>', [], {}),
]
for i, (name, desc, html, schema, inp) in enumerate(composers):
    cid = nid()
    t = NOW - (9 - i) * DAY
    ins('composer', {'id': cid, 'name': name, 'description': desc, 'folder_id': COMP_FOLDER, 'organization_id': ORG, 'created_by': USER, 'created_at': t, 'updated_at': t})
    cfg = {'schema': schema, 'inputData': inp, 'inputDataRootName': None}
    vid = nid()
    ins('composer_version', {'id': vid, 'composer_id': cid, 'major': 1, 'minor': 0, 'patch': 0, 'content': html, 'config': json.dumps(cfg), 'created_by': USER, 'created_at': t, 'updated_at': t, 'updated_by': USER, 'published_at': t, 'published_by': USER})
    if name == 'Product Launch Kit':
        print(f'-- composer {cid}', flush=True)
        for pname in ['Product Description Writer', 'Launch Email Writer', 'Social Post Generator']:
            pid = prompt_ids[pname]
            ins('composer_version_prompt', {'id': nid(), 'composer_version_id': vid, 'prompt_id': pid, 'prompt_version_id': prompt_latest[pid], 'auto_update': 0, 'created_at': t})

# ---------- API usage (September, steady growth with weekly rhythm) ----------
out.append(f"DELETE FROM api_usage WHERE organization_id = '{ORG}';")
month_total = 0
for d in range(1, 28):
    weekday = (d + 1) % 7  # Sep 1 2026 is a Tuesday
    base = 900 + d * 95
    weekend = 0.55 if weekday in (5, 6) else 1.0
    count = int(base * weekend * random.uniform(0.9, 1.12))
    month_total += count
    ins('api_usage', {'organization_id': ORG, 'period': f'2026-09-{d:02d}', 'count': count, 'created_at': NOW, 'updated_at': NOW})
# The analytics ring reads the monthly row, the chart reads the daily rows.
ins('api_usage', {'organization_id': ORG, 'period': '2026-09', 'count': month_total, 'created_at': NOW, 'updated_at': NOW})

print('\n'.join(out))
