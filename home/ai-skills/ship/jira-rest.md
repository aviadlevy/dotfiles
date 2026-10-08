# Setting a Jira field over REST

For a field that `jira issue edit --custom` reported as set but the read-back shows empty: the
local field cache (`~/.config/.jira/.config.yml`) maps that name to a stale key.

1. **Resolve the live key.** Match the field's display name in `GET /rest/api/3/field`.
2. **Set it by key**, then read it back.

The script builds the auth header itself and prints only status codes and values; the token
and the header stay inside it.

```bash
python3 - <<'EOF'
import os, json, base64, urllib.request, yaml
cfg = yaml.safe_load(open(os.path.expanduser('~/.config/.jira/.config.yml')))
auth = base64.b64encode(f"{cfg['login']}:{os.environ['JIRA_API_TOKEN']}".encode()).decode()
S, KEY, NAME, VALUE = cfg['server'], '<TICKET_ID>', '<field display name>', '<value>'
def call(m, path, body=None):
    r = urllib.request.Request(f'{S}{path}', method=m,
        data=json.dumps(body).encode() if body else None,
        headers={'Authorization': f'Basic {auth}', 'Accept': 'application/json',
                 'Content-Type': 'application/json'})
    with urllib.request.urlopen(r) as resp:
        t = resp.read().decode()
        return resp.status, (json.loads(t) if t.strip() else None)
fid = next(f['id'] for f in call('GET', '/rest/api/3/field')[1] if f['name'] == NAME)
print(fid, call('PUT', f'/rest/api/3/issue/{KEY}', {'fields': {fid: VALUE}})[0])
print(call('GET', f'/rest/api/3/issue/{KEY}?fields={fid}')[1]['fields'][fid])
EOF
```

A dropdown field takes `{'value': '<option string>'}` instead of a bare string.
