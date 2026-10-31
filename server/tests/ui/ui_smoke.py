import json, urllib.request, sys
from playwright.sync_api import sync_playwright
BASE="http://127.0.0.1:4173"
def api(method,url,tok=None,body=None):
    r=urllib.request.Request(BASE+url,method=method,data=json.dumps(body).encode() if body else None,headers={"Content-Type":"application/json",**({"Authorization":"Bearer "+tok} if tok else {})})
    try: return json.load(urllib.request.urlopen(r))
    except urllib.error.HTTPError as e: return {"_status":e.code}
tok=api("POST","/api/auth/login",body={"email":"admin@t.com","password":"Password123!"})["accessToken"]
c=api("POST","/api/finance/clients",tok,{"name":"Acme Co","startDate":"2026-04-01","contractValue":50000})
import datetime; n=datetime.datetime.utcnow()
api("POST","/api/finance/payments",tok,{"clientId":c["_id"],"amount":12000,"paymentDate":n.isoformat()+"Z","month":n.month,"year":n.year})
api("POST","/api/finance/expenses",tok,{"title":"Rent","amount":3000,"category":"Rent","expenseDate":n.isoformat()+"Z"})

results=[]; errors=[]
def check(name,ok,extra=""): results.append((name,ok,extra)); print(("PASS " if ok else "FAIL ")+name+(" — "+extra if extra else ""))

with sync_playwright() as p:
    b=p.chromium.launch()
    def session(email):
        ctx=b.new_context(viewport={"width":1400,"height":900}); pg=ctx.new_page()
        pg.on("console",lambda m: errors.append((email,m.text)) if m.type=="error" else None)
        pg.on("pageerror",lambda e: errors.append((email,"PAGEERROR "+str(e))))
        pg.on("response",lambda r: errors.append((email,f"HTTP {r.status} {r.url}")) if r.status>=500 else None)
        pg.goto(BASE+"/login"); pg.fill('input[type="email"]',email); pg.fill('input[type="password"]',"Password123!")
        pg.click('button[type="submit"]'); pg.wait_for_url("**/admin/dashboard",timeout=15000); return pg

    # ---------- admin ----------
    a=session("admin@t.com"); a.wait_for_timeout(2000)
    body=a.inner_text("body")
    check("admin dashboard shows overview: attendance widget", "Today’s attendance" in body)
    check("admin dashboard shows overview: finance widget with real revenue", "Revenue & Finance" in body and "12,000" in body, "₹12,000 revenue")
    nav=a.inner_text("nav")
    for label in ["Overview","Clients & Team","Tasks & Projects","Attendance","Revenue & Finance","Reports & Analytics","Settings & Administration","Identity Links","Attendance Admin","Kanban","Team"]:
        check(f"admin sidebar has '{label}'", label in nav)
    a.screenshot(path="/tmp/shots/admin_dashboard.png")

    a.click('nav >> text=Revenue & Finance'); a.wait_for_timeout(2500)
    check("finance dashboard loads", "/admin/finance" in a.url and "Acme" in a.inner_text("body") or "12,000" in a.inner_text("body"))
    a.screenshot(path="/tmp/shots/finance_dashboard.png")
    a.goto(BASE+"/admin/finance/clients"); a.wait_for_timeout(2500)   # direct deep link / refresh
    check("finance deep link works on hard refresh + shows client from accountant DB", "Acme Co" in a.inner_text("body"))
    a.screenshot(path="/tmp/shots/finance_clients.png")
    for path,needle in [("salaries","alar"),("expenses","Rent"),("reports","eport"),("settings","ompany")]:
        a.goto(BASE+f"/admin/finance/{path}"); a.wait_for_timeout(1800)
        check(f"finance /{path} renders", needle in a.inner_text("body"))
    a.goto(BASE+"/admin/attendance/manage"); a.wait_for_timeout(2200)
    check("attendance admin overview renders (deep link)", "ttendance" in a.inner_text("body"))
    a.screenshot(path="/tmp/shots/attendance_admin.png")
    for path in ["employees","attendance","reports","wfh-requests","leave-requests","regularization-requests"]:
        a.goto(BASE+f"/admin/attendance/manage/{path}"); a.wait_for_timeout(1600)
        check(f"attendance admin /{path} renders w/o crash", "Something went wrong" not in a.inner_text("body") and len(a.inner_text("body"))>200)
    a.goto(BASE+"/admin/identity"); a.wait_for_timeout(1800)
    check("identity page lists accounts", "Emp One" in a.inner_text("body"))
    a.screenshot(path="/tmp/shots/identity.png")
    a.goto(BASE+"/admin/attendance"); a.wait_for_timeout(1800)
    check("admin w/o attendance profile is sent to admin overview, not a crash", "/admin/attendance/manage" in a.url)

    # ---------- employee ----------
    e=session("emp1@t.com"); e.wait_for_timeout(2000)
    nav=e.inner_text("nav")
    check("employee sees Attendance in nav", "Attendance" in nav)
    check("employee does NOT see Revenue & Finance / Identity / Attendance Admin", not any(x in nav for x in ["Revenue & Finance","Identity Links","Attendance Admin"]))
    check("employee dashboard has no finance widget", "Revenue & Finance" not in e.inner_text("main") )
    e.goto(BASE+"/admin/attendance"); e.wait_for_timeout(2500)
    check("employee attendance dashboard renders", "heck" in e.inner_text("body"))
    e.screenshot(path="/tmp/shots/employee_attendance.png")
    e.goto(BASE+"/admin/finance"); e.wait_for_timeout(2000)
    check("employee blocked from finance UI", "No access" in e.inner_text("body"))
    e.goto(BASE+"/admin/attendance/manage"); e.wait_for_timeout(2000)
    check("employee redirected away from attendance admin", "/manage" not in e.url)
    # direct API with employee token also refused
    et=e.evaluate("localStorage.getItem('accessToken')")
    check("employee finance API refused (403)", api("GET","/api/finance/clients",et).get("_status")==403)
    b.close()

bad=[x for x in errors if not any(s in x[1] for s in ["Failed to load resource: the server responded with a status of 40","favicon","manifest"])]
print("\nconsole/network errors:",len(bad)); [print("  ",x) for x in bad[:15]]
print("\nSUMMARY: %d/%d passed"%(sum(1 for r in results if r[1]),len(results)))
sys.exit(0 if all(r[1] for r in results) else 1)
