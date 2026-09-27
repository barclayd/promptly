# Demo activity history + MCP connections for the showreel capture workspace.
import random, string
ORG = '109p05TqPMKpD2B8Qhxjmn4RT9I1hF6X'
USER = 'C1SCtrjt0WyOD9tFW7aCKluGUDLjmfjS'
MEMBER = '5ZFRCptgkFbM4QmKUOzWWyKjwYEZzHpa'
NOW = 1790530728543
MIN, HOUR, DAY = 60_000, 3_600_000, 86_400_000
random.seed(11)
nid = lambda: ''.join(random.choices(string.ascii_letters + string.digits, k=21))
P = {'desc': 'JdQnEkoz86BHapdUtZg4o', 'email': 'tEPO6UkzYuF0ie9Pu2njH', 'social': '4FxFEtKyPiYGFDm7ena8D',
     'support': 'sfAGeAbP0VxNjAe-9i0mY', 'seo': 'fZuXTptFyfePpX6N1NF2X', 'churn': '4ffqkOkgWrdioyq_KvCiS'}
C = {'kit': 'W88ad3DNBYjvsedonuSsd', 'digest': 'AMH2vWD6qeSPt5Pv74GDq'}
conns = {'Claude Code': (nid(), 'claude-code', '["mcp:read","mcp:write","mcp:publish","mcp:run"]', NOW - 6 * DAY, NOW - 4 * MIN),
         'Cursor': (nid(), 'cursor', '["mcp:read","mcp:write"]', NOW - 3 * DAY, NOW - 2 * HOUR)}
out = [f"DELETE FROM authoring_change WHERE organization_id = '{ORG}';", f"DELETE FROM mcp_connection WHERE organization_id = '{ORG}';"]
for name, (cid, client, scopes, created, used) in conns.items():
    out.append(f"INSERT INTO mcp_connection (id,user_id,organization_id,membership_id,client_id,client_name,scopes,created_at,last_used_at) VALUES ('{cid}','{USER}','{ORG}','{MEMBER}','{client}','{name}','{scopes}',{created},{used});")
# (ago_ms, kind, key, operation, client or None)
events = [
    (4 * MIN, 'p', 'desc', 'update_prompt', 'Claude Code'),
    (11 * MIN, 'c', 'kit', 'publish_composer', None),
    (26 * MIN, 'p', 'social', 'update_prompt', 'Cursor'),
    (48 * MIN, 'p', 'desc', 'publish_prompt', None),
    (2 * HOUR, 'c', 'kit', 'update_composer', 'Claude Code'),
    (3 * HOUR, 'p', 'email', 'publish_prompt', 'Claude Code'),
    (5 * HOUR, 'p', 'support', 'update_prompt', None),
    (7 * HOUR, 'p', 'churn', 'create_prompt', 'Claude Code'),
    (DAY, 'c', 'digest', 'create_composer', None),
    (DAY + 3 * HOUR, 'p', 'seo', 'update_prompt', 'Cursor'),
]
for ago, kind, key, op, client in events:
    t = NOW - ago
    pid = f"'{P[key]}'" if kind == 'p' else 'NULL'
    cmp = f"'{C[key]}'" if kind == 'c' else 'NULL'
    if client:
        cid, cl, *_ = conns[client]
        scope, conn, clid, cname = f'mcp:{cid}', f"'{cid}'", f"'{cl}'", f"'{client}'"
    else:
        scope, conn, clid, cname = f'browser:{USER}', 'NULL', 'NULL', 'NULL'
    out.append(f"INSERT INTO authoring_change (id,organization_id,prompt_id,composer_id,actor_user_id,actor_name,actor_scope,connection_id,client_id,client_name,operation,revision,version_id,created_at,expires_at) VALUES ('{nid()}','{ORG}',{pid},{cmp},'{USER}','Alex Morgan','{scope}',{conn},{clid},{cname},'{op}','{nid()}',NULL,{t},{t + 90 * DAY});")
print('\n'.join(out))
