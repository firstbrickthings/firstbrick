/* Install in the existing Apps Script project, then deploy a new web-app version.
 * Script properties (Project Settings):
 * BABYONE_REPORTING_SECRET = a privately generated random secret (also set as Railway SHEETS_SECRET)
 * BABYONE_SPREADSHEET_ID = the ID of the private reporting spreadsheet
 * Railway: SHEETS_URL = your /exec URL, SHEETS_ENABLED = true (only after receiver setup).
 * Execute web app as its owner. Its HMAC signature authorizes writes; no secrets belong in HTML.
 */
function reply_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
function doGet() { return reply_({ok:true,protocol:'babyone-signed-reporting-v1'}); }
function doPost(e) {
  var lock=LockService.getScriptLock();
  try {
    if (!e || !e.postData || e.postData.contents.length>262144) return reply_({ok:false});
    var input=JSON.parse(e.postData.contents),props=PropertiesService.getScriptProperties();
    var secret=props.getProperty('BABYONE_REPORTING_SECRET'),sheetId=props.getProperty('BABYONE_SPREADSHEET_ID');
    if (!secret || !sheetId || typeof input.body!=='string' || typeof input.timestamp!=='string' || !/^\d+$/.test(input.timestamp)) return reply_({ok:false});
    if (Math.abs(Date.now()/1000-Number(input.timestamp))>300) return reply_({ok:false});
    var bytes=Utilities.computeHmacSha256Signature(input.timestamp+'.'+input.body,secret,Utilities.Charset.UTF_8);
    var expected=bytes.map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2)}).join('');
    var supplied=String(input.signature||''),mismatch=expected.length^supplied.length;
    for(var i=0;i<expected.length;i++) mismatch|=expected.charCodeAt(i)^(supplied.charCodeAt(i)||0);
    if(mismatch) return reply_({ok:false});
    var event=JSON.parse(input.body);
    if (!/^[a-f0-9-]{36}$/.test(event.event_id||'') || ['order_created','order_status','payment_confirmed'].indexOf(event.kind)<0) return reply_({ok:false});
    lock.waitLock(20000);
    var book=SpreadsheetApp.openById(sheetId),sheet=book.getSheetByName('BabyOne Orders');
    if(!sheet){sheet=book.insertSheet('BabyOne Orders');sheet.appendRow(['Event ID','Received at','Event','Order ID','Status','Payment','Total INR','Phone','Name','Address','City','State','PIN','Email','Items']);sheet.setFrozenRows(1)}
    if(sheet.getLastRow()>1){var found=sheet.getRange(2,1,sheet.getLastRow()-1,1).createTextFinder(event.event_id).matchEntireCell(true).findNext();if(found)return reply_({ok:true,event_id:event.event_id,duplicate:true})}
    var p=event.payload||{},c=p.customer||{};
    function text(v){var s=String(v==null?'':v);return /^[=+\-@\t\r]/.test(s)?"'"+s:s}
    sheet.appendRow([event.event_id,new Date().toISOString(),event.kind,p.order_id,p.status,p.payment,p.total,c.phone,c.name,c.address,c.city,c.state,c.pin,c.email,JSON.stringify(p.items||[])].map(text));
    SpreadsheetApp.flush();
    return reply_({ok:true,event_id:event.event_id});
  } catch(error) { return reply_({ok:false,error:'Reporting receiver could not save the event.'}); }
  finally { if(lock.hasLock())lock.releaseLock(); }
}
