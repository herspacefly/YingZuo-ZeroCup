"""Pinned edge-tts 7.3.1; generate original MP3 streams with resumable validation.
Run prepare-voice.mjs first. No runtime API keys or network service are needed by the site.
"""
import asyncio, hashlib, json, os, pathlib, subprocess, sys
from importlib.metadata import version
import edge_tts

ROOT=pathlib.Path(__file__).resolve().parent.parent
REQUEST=json.loads((ROOT/'.preflight/t38-voice-request.json').read_text(encoding='utf-8'))
if version('edge-tts') != REQUEST['engineVersion']:
    raise RuntimeError(f"Install edge-tts=={REQUEST['engineVersion']} before generating; refusing inaccurate provenance")
CHECKPOINT=ROOT/'.preflight/t38-voice-results.json'
CATALOG=ROOT/'src/content/voice-v5.json'
RESULTS=json.loads(CHECKPOINT.read_text(encoding='utf-8')) if CHECKPOINT.exists() else ({l['id']:l for l in json.loads(CATALOG.read_text(encoding='utf-8'))['lines']} if CATALOG.exists() else {})
LINES=REQUEST['lines'][:4] if '--samples' in sys.argv else REQUEST['lines']
SEM=asyncio.Semaphore(3)
FAILURES=[]

def checkpoint():
    temp=CHECKPOINT.with_suffix('.tmp')
    temp.write_text(json.dumps(RESULTS,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
    os.replace(temp,CHECKPOINT)

def measure(p):
    subprocess.run(['ffmpeg','-v','error','-i',str(p),'-f','null','-'],check=True,capture_output=True,timeout=30)
    info=json.loads(subprocess.check_output(['ffprobe','-v','error','-show_entries','format=duration','-of','json',str(p)],timeout=15))
    return round(float(info['format']['duration'])*1000)

async def generate(line):
    async with SEM:
        dest=ROOT/'public'/line['src'].lstrip('/')
        old=RESULTS.get(line['id'])
        if old and dest.exists() and all(old.get(k)==line[k] for k in ['text','voice','rate','pitch']) and hashlib.sha256(dest.read_bytes()).hexdigest()==old.get('sha256'):
            return
        RESULTS.pop(line['id'],None)
        dest.parent.mkdir(parents=True,exist_ok=True)
        temp=dest.with_suffix('.part.mp3')
        for attempt in range(3):
            try:
                job=edge_tts.Communicate(line['text'],line['voice'],rate=line['rate'],pitch=line['pitch'],connect_timeout=15,receive_timeout=30)
                await asyncio.wait_for(job.save(str(temp)),timeout=65)
                duration=await asyncio.to_thread(measure,temp)
                if duration<=0: raise ValueError('Empty decoded audio')
                data=temp.read_bytes()
                os.replace(temp,dest)
                RESULTS[line['id']]={**line,'durationMs':duration,'bytes':len(data),'sha256':hashlib.sha256(data).hexdigest()}
                checkpoint()
                print(f"OK {len(RESULTS)}/{len(REQUEST['lines'])} {line['speaker']} {line['id']} {duration}ms",flush=True)
                return
            except Exception as error:
                if temp.exists(): temp.unlink()
                print(f"RETRY {line['id']} attempt {attempt+1}: {type(error).__name__}: {error}",flush=True)
                if attempt<2: await asyncio.sleep(2*(attempt+1))
        FAILURES.append(line['id'])

async def main():
    await asyncio.gather(*(generate(line) for line in LINES))
    # A clean checkout can resume solely from the committed catalog. Persist that
    # validated cache even when no new line was synthesized, so --compile works.
    checkpoint()
    print(json.dumps({'requested':len(LINES),'completed':len(RESULTS),'failed':FAILURES}),flush=True)
    if FAILURES: sys.exit(1)

asyncio.run(main())
