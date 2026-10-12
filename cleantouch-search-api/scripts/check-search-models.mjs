const response=await fetch('https://generativelanguage.googleapis.com/v1beta/models',{headers:{'x-goog-api-key':process.env.GEMINI_API_KEY}});
const body=await response.json();console.log(JSON.stringify({status:response.status,models:(body.models||[]).map(m=>m.name).filter(n=>/2\.5|flash-lite/.test(n))}));
