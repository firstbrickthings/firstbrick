"""Fake providers only: honest reviews, unread orders and the isolated ₹1 check."""
import base64
from email import message_from_bytes
from sqlalchemy import func, select
from app import owner_notifications as emails
from app import payments
from app.db import sessions
from app.live_check_catalog import configure, PRODUCT_ID, VARIANT_ID
from app.models import ReportingEvent, Variant
from conftest import headers
from test_store import payload
from test_payments import gateway, start, callback
from test_live_payments import live


def order(client, key='experience-order-001'):
    response=client.post('/api/orders',json=payload(client,items=[{'variant_id':'sku-bottle','quantity':1}],key=key),headers=headers())
    assert response.status_code==200,response.text
    return response.json()


def test_count_is_private_and_acknowledges_only_orders_viewed(client):
    assert client.get('/api/admin/order-activity').status_code==401
    assert client.get('/api/admin/order-activity',headers=headers()).status_code==403
    first=order(client)
    before=client.get('/api/admin/order-activity',headers=headers('owner')).json()
    assert before['new_count']==1 and before['latest_order_id']==first['id']
    second=order(client,key='experience-order-002')
    # A later order arriving while the owner reads the earlier list stays unread.
    after=client.put('/api/admin/order-activity',json={'last_event_id':before['latest_event_id']},headers=headers('owner')).json()
    assert after['new_count']==1 and after['latest_order_id']==second['id']
    assert client.put('/api/admin/order-activity',json={'last_event_id':after['latest_event_id']+1},headers=headers('owner')).status_code==409
    assert client.put('/api/admin/order-activity',json={'last_event_id':after['latest_event_id']},headers=headers('owner')).json()['new_count']==0


def test_unpaid_orders_do_not_count_or_send_owner_email(client,gateway):
    saved,checkout=start(client,gateway)
    assert client.get('/api/admin/order-activity',headers=headers('owner')).json()['new_count']==0
    with sessions()() as db:
        assert db.scalar(select(func.count()).select_from(ReportingEvent).where(ReportingEvent.kind==emails.KIND))==0
    verify=callback(gateway,checkout)
    for _ in range(2):
        assert client.post('/api/payments/razorpay/'+saved['id']+'/verify',json=verify,headers=headers()).status_code==200
    assert client.get('/api/admin/order-activity',headers=headers('owner')).json()['new_count']==1
    with sessions()() as db:
        assert db.scalar(select(func.count()).select_from(ReportingEvent).where(ReportingEvent.kind==emails.KIND))==1


def test_customer_review_requires_real_purchase_and_owner_publishing(client):
    review={'name':'A parent','rating':4,'message':'Useful bottle for our daily feeds.'}
    assert client.post('/api/me/reviews',json=review).status_code==401
    assert client.post('/api/me/reviews',json=review,headers=headers()).status_code==409
    bought=order(client)
    # COD is not treated as a completed purchase until delivery.
    assert client.post('/api/me/reviews',json=review,headers=headers()).status_code==409
    for status in ['Packed','Shipped','Out for Delivery','Delivered']:
        assert client.patch('/api/admin/orders/'+bought['id'],json={'status':status},headers=headers('owner')).status_code==200
    saved=client.post('/api/me/reviews',json=review,headers=headers())
    assert saved.status_code==201 and saved.json()['published'] is False
    assert client.get('/api/store/reviews').json()==[]
    assert client.post('/api/me/reviews',json=review,headers=headers()).status_code==409
    identifier=saved.json()['id']
    assert client.put('/api/admin/reviews/'+identifier,json={**review,'published':True,'position':0},headers=headers('owner')).status_code==200
    visible=client.get('/api/store/reviews').json()
    assert len(visible)==1 and visible[0]['message']==review['message'] and visible[0]['verified_purchase'] is True


def test_owner_mail_is_deduplicated_and_kept_out_of_sheets(client,monkeypatch):
    bought=order(client)
    with sessions()() as db:
        row=db.scalar(select(ReportingEvent).where(ReportingEvent.kind==emails.KIND))
        assert row.payload['order_id']==bought['id']
        mail=emails.message(row)
        assert mail['To']=='babyonestores@gmail.com'
        assert ':' not in mail['Message-ID'] and mail['Date']
        assert 'Baby bottle' in mail.get_body(preferencelist=('plain',)).get_content()
        assert 'Cash on delivery' in mail.get_body(preferencelist=('plain',)).get_content()
        assert 'GST invoice' not in mail.as_string()
    sent=[]
    monkeypatch.setattr(emails,'connected',lambda db:True)
    monkeypatch.setattr(emails,'send',lambda db,event:sent.append(event.id))
    emails.drain();emails.drain()
    assert len(sent)==1
    status=client.get('/api/admin/notifications/email',headers=headers('owner')).json()
    assert status['counts']['sent']==1
    assert client.get('/api/admin/notifications/email',headers=headers()).status_code==403


def test_owner_mail_ambiguous_response_never_resends(client,monkeypatch):
    order(client)
    sent=[]
    monkeypatch.setattr(emails,'connected',lambda db:True)
    def uncertain(db,event):
        sent.append(event.id)
        raise emails.DeliveryError(uncertain=True)
    monkeypatch.setattr(emails,'send',uncertain)
    emails.drain();emails.drain()
    assert len(sent)==1
    with sessions()() as db:
        assert db.scalar(select(ReportingEvent).where(ReportingEvent.kind==emails.KIND)).status=='uncertain'


def test_missing_mailbox_blocks_sends_and_reports_setup(client,monkeypatch):
    order(client)
    monkeypatch.setattr(emails,'connected',lambda db:False)
    monkeypatch.setattr(emails,'send',lambda *args:(_ for _ in ()).throw(AssertionError('No live send allowed')))
    emails.drain()
    status=client.get('/api/admin/notifications/email',headers=headers('owner')).json()
    assert status['connected'] is False and status['counts']['pending']==1
    assert client.get('/api/admin/notifications/email/check',headers=headers('owner')).json()['ready'] is False


def test_email_html_escapes_customer_and_product_text(client):
    order(client)
    with sessions()() as db:
        event=db.scalar(select(ReportingEvent).where(ReportingEvent.kind==emails.KIND))
        p=event.payload
        event.payload={**p,'customer':{**p['customer'],'name':'<script>alert(1)</script>'}}
        html=emails.message(event).get_body(preferencelist=('html',)).get_content()
        assert '<script>' not in html and '&lt;script&gt;' in html


def test_owner_mail_provider_uses_fixed_recipient_and_https(client,monkeypatch):
    order(client)
    monkeypatch.setattr(emails,'token',lambda db:'fake-access-token')
    calls=[]
    class Reply:
        status_code=200
        def json(self):return {'id':'fake-message'}
    monkeypatch.setattr(emails.requests,'post',lambda url,**kwargs:(calls.append((url,kwargs)) or Reply()))
    with sessions()() as db:
        emails.send(db,db.scalar(select(ReportingEvent).where(ReportingEvent.kind==emails.KIND)))
    assert calls[0][0]=='https://gmail.googleapis.com/gmail/v1/users/me/messages/send'
    mail=message_from_bytes(base64.urlsafe_b64decode(calls[0][1]['json']['raw']))
    assert mail['To']=='babyonestores@gmail.com' and 'New order' in mail['Subject']


def test_one_rupee_check_is_separate_free_delivery_and_does_not_reset(client,live):
    cart=client.put('/api/me/cart',json={'items':[{'variant_id':'sku-bottle','quantity':1}], 'expected_version':0},headers=headers()).json()
    with sessions()() as db:
        configure(db);db.commit()
        assert db.get(Variant,VARIANT_ID).product.metadata_json['subcategory']=='Hospital Bags'
        db.get(Variant,VARIANT_ID).stock=3
        db.commit();configure(db);db.commit()
        assert db.get(Variant,VARIANT_ID).stock==3
    items=[{'variant_id':VARIANT_ID,'quantity':1}]
    quote=client.post('/api/checkout/quote',json={'items':items,'pin':'673661'},headers=headers()).json()
    assert quote['total']=='1.00' and quote['delivery']=='0.00' and quote['cod_allowed'] is False
    assert client.post('/api/checkout/quote',json={'items':items+[{'variant_id':'sku-bottle','quantity':1}],'pin':'673661'},headers=headers()).status_code==409
    assert client.post('/api/checkout/quote',json={'items':[{'variant_id':VARIANT_ID,'quantity':2}],'pin':'673661'},headers=headers()).status_code==409
    saved=client.post('/api/orders',json={'items':items,'shipping':{'name':'Parent','address':'12 Test Road','city':'Mukkam','state':'Kerala','pin':'673661'},'quote_hash':quote['quote_hash'],'idempotency_key':'one-rupee-check-001','payment':'RAZORPAY'},headers=headers())
    assert saved.status_code==200,saved.text
    assert saved.json()['kind']=='gateway_check'
    payment=client.post('/api/payments/razorpay/'+saved.json()['id']+'/checkout',headers=headers()).json()
    assert payment['checkout']['amount']==100
    assert '₹1.00' in payment['checkout']['description'] and '₹10' not in payment['checkout']['description']
    verified=client.post('/api/payments/razorpay/'+saved.json()['id']+'/verify',json=callback(live,payment),headers=headers()).json()
    assert verified['order']['status']=='Payment Verified'
    captures=live.captures
    assert payments.audit_recent_live_check()=={'mode':'live','amount_paise':100,'currency':'INR','provider_status':'captured','captured':True,'recorded_status':'paid'}
    assert live.captures==captures, 'The diagnostic must never capture a payment'
    kept=client.get('/api/me/cart',headers=headers()).json()
    assert kept['version']==cart['version'] and kept['ordered'] is False and kept['items'][0]['variant_id']=='sku-bottle'
    assert client.get('/api/admin/order-activity',headers=headers('owner')).json()['new_count']==0
    with sessions()() as db:
        assert db.scalar(select(func.count()).select_from(ReportingEvent))==0
    # A normal product still receives the unchanged configured delivery rate.
    normal=client.post('/api/checkout/quote',json={'items':[{'variant_id':'sku-bottle','quantity':1}],'pin':'682001'},headers=headers()).json()
    assert normal['delivery']=='30.00'


def test_catalogue_check_does_not_replace_the_existing_owner_check(client,live):
    with sessions()() as db:
        configure(db);db.commit()
    items=[{'variant_id':VARIANT_ID,'quantity':1}]
    quote=client.post('/api/checkout/quote',json={'items':items,'pin':'673661'},headers=headers('owner')).json()
    data={'items':items,'shipping':{'name':'Owner','address':'12 Store Road','city':'Mukkam','state':'Kerala','pin':'673661'},'quote_hash':quote['quote_hash'],'idempotency_key':'catalogue-owner-check-001','payment':'RAZORPAY'}
    product=client.post('/api/orders',json=data,headers=headers('owner')).json()
    assert client.get('/api/admin/payments/check/latest',headers=headers('owner')).json()['order'] is None
    check=client.post('/api/admin/payments/check',json={'request_id':'eb7bd267-cd23-40e2-88c3-a798526da43a'},headers=headers('owner')).json()
    assert check['id']!=product['id'] and check['total']=='10.00'
