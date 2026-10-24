#!/usr/bin/env python3
"""Linux-only headless benchmark sampler; build catalog_load first.
Synthetic fixture protector is deliberately not production encryption.
"""
import subprocess,time,json,pathlib,platform
root=pathlib.Path(__file__).resolve().parents[1]
binary=str(root/'src-tauri/target/debug/examples/catalog_load')
results=[]
for count in [1000,10000,30000,50000]:
 p=subprocess.Popen([binary,str(count)],stdout=subprocess.PIPE,stderr=subprocess.PIPE,text=True)
 peak=0;started=time.monotonic()
 while p.poll() is None:
  try:
   lines=pathlib.Path(f'/proc/{p.pid}/status').read_text().splitlines()
   vals=[int(line.split()[1]) for line in lines if line.startswith(('VmRSS:','VmHWM:'))]
   peak=max([peak]+vals)
  except (FileNotFoundError,ProcessLookupError):pass
  time.sleep(.005)
 out,err=p.communicate()
 if p.returncode:raise RuntimeError(err)
 result=json.loads(out);result.update(peakRssKiB=peak,wallMs=round((time.monotonic()-started)*1000,3));results.append(result);print(json.dumps(result),flush=True)
report={'platform':platform.platform(),'profile':'Rust debug, headless Linux; SQLite in memory; fixture-only XOR protector (NOT DPAPI)','rssMethod':'/proc child VmRSS/VmHWM every 5ms; includes fixture generation, excludes cargo/compiler; one run per size','results':results}
(root/'docs').mkdir(exist_ok=True)
(root/'docs/phase3-load-results.json').write_text(json.dumps(report,indent=2)+'\n')
