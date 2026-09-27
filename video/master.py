"""Two-pass loudnorm of a Resolve render to -14 LUFS / -1 dBTP, video stream copied.  usage: python3 master.py in.mp4 out.mp4"""
import json, re, subprocess, sys
src, dst = sys.argv[1], sys.argv[2]
err = subprocess.run(['ffmpeg', '-hide_banner', '-i', src, '-af', 'loudnorm=I=-14:TP=-1.0:LRA=11:print_format=json', '-f', 'null', '-'], capture_output=True, text=True).stderr
m = json.loads(re.search(r'\{[^{}]*"input_i"[^{}]*\}', err, re.S).group(0))
af = (f"loudnorm=I=-14:TP=-1.0:LRA=11:measured_I={m['input_i']}:measured_TP={m['input_tp']}:measured_LRA={m['input_lra']}"
      f":measured_thresh={m['input_thresh']}:offset={m['target_offset']}:linear=true,aresample=48000")
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', src, '-map', '0:v:0', '-map', '0:a:0', '-c:v', 'copy', '-af', af, '-c:a', 'aac', '-b:a', '320k',
                '-movflags', '+faststart', dst], check=True)
out = subprocess.run(['ffmpeg', '-hide_banner', '-i', dst, '-af', 'ebur128=peak=true', '-f', 'null', '-'], capture_output=True, text=True).stderr
print('in', m['input_i'], 'LUFS ->', re.findall(r'I:\s+(-?[\d.]+) LUFS', out)[-1], 'LUFS, peak', re.findall(r'Peak:\s+(-?[\d.]+) dBFS', out)[-1], 'dBFS')
