const fs=require('fs');const path=require('path');
const file=path.resolve(__dirname,'../cleantouch-desktop/index.html');let s=fs.readFileSync(file,'utf8');
s=s.replaceAll('화면 살펴보기 종료','스캔 멈춤');
s=s.replace('모두 분석을 누르면 스캔을 일시정지하고 지금까지 모은 장면을 분석합니다. 분석 후 스캔 계속하기를 누르면 이어서 모읍니다.','모두 분석을 누르면 스캔을 계속하면서 모은 장면과 새 장면을 자동으로 분석합니다. 스캔 멈춤을 누르면 장면 수집을 멈추고 이미 모은 장면은 끝까지 분석합니다.');
fs.writeFileSync(file,s);
