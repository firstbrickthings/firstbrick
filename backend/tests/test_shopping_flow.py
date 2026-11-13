"""Functional cart activity and complete WhatsApp bills; all sends use a fake provider."""
from datetime import timedelta
from sqlalchemy import select
from app.db import sessions
from app.models import Customer, CustomerCart, StoreDocument, WhatsAppMessage, now
from app import messaging
from app.carts import activity_key
from conftest import headers
from test_carts_messaging import sending, preference, cart, age_reminders
from test_store import payload


def test_activity_defers_one_reminder_and_preserves_cart(client,sending):
    preference(client);saved=cart(client).json();age_reminders()
    before=client.get('/api/me/cart',headers=headers()).json()
    assert client.post('/api/me/cart/activity',headers=headers()).json()=={'tracked':True}
    after=client.get('/api/me/cart',headers=headers()).json()
    assert after['version']==before['version'] and after['items']==before['items'] and after['updated_at']==before['updated_at']
    messaging.drain();assert sending==[]
    with sessions()() as db:
        messages=list(db.scalars(select(WhatsAppMessage).where(WhatsAppMessage.kind=='cart_reminder')))
        assert len(messages)==1 and messages[0].status=='pending' and messages[0].due_at>now()+timedelta(minutes=19)
        db.get(StoreDocument,activity_key('customer-uid')).value={'last_active_at':(now()-timedelta(minutes=21)).isoformat()}
        messages[0].due_at=now()-timedelta(seconds=1);db.commit()
    messaging.drain();messaging.drain();assert len(sending)==1
    text=' '.join(p['text'] for p in sending[0]['template']['components'][0]['parameters'])
    assert 'Baby bottle × 2' in text and '998.00' in text
    assert 'recover_cart=' in sending[0]['template']['components'][1]['parameters'][0]['text']


def test_activity_is_private_and_only_runs_for_opted_in_saved_carts(client):
    assert client.post('/api/me/cart/activity').status_code==401
    cart(client)
    assert client.post('/api/me/cart/activity',headers=headers()).json()=={'tracked':False}
    with sessions()() as db:assert db.get(StoreDocument,activity_key('customer-uid')) is None
    preference(client,cart_reminders=False)
    assert client.post('/api/me/cart/activity',headers=headers()).json()=={'tracked':False}


def test_order_message_contains_prices_delivery_bill_and_estimate(client,sending):
    preference(client)
    order=client.post('/api/orders',json=payload(client),headers=headers()).json()
    messaging.drain();messaging.drain();assert len(sending)==1
    values=[p['text'] for p in sending[0]['template']['components'][0]['parameters']]
    assert order['id'] in values and 'Baby bottle' in values[3] and '998.00' in values[3]
    assert 'Delivery ₹60.00' in values[4] and 'Total ₹1058.00' in values[4] and '5–6 days' in values[4]


def test_cart_reminder_uses_full_bill_when_saved_pin_is_known(client,sending):
    preference(client);cart(client);age_reminders()
    with sessions()() as db:
        db.get(Customer,'customer-uid').details={'name':'Parent','pin':'682001'};db.commit()
    messaging.drain();assert len(sending)==1
    summary=sending[0]['template']['components'][0]['parameters'][2]['text']
    assert 'Delivery ₹60.00' in summary and 'Total ₹1058.00' in summary


def test_long_cart_lists_are_honest_and_point_to_the_complete_bill():
    items=[{'name':'Long product name for a real catalogue option '+str(i),'qty':2,'price':'10.00'} for i in range(30)]
    text=messaging.item_summary(items)
    assert len(text)<700 and 'more item(s)' in text and 'full bill in the checkout link' in text


def test_payment_check_is_not_promoted_as_a_delivery_order(client,sending):
    from app.live_check_catalog import configure,VARIANT_ID
    with sessions()() as db:
        configure(db);db.commit()
    preference(client);cart(client,items=[{'variant_id':VARIANT_ID,'quantity':1}]);age_reminders()
    messaging.drain()
    assert sending==[]
    with sessions()() as db:
        assert db.scalar(select(WhatsAppMessage).where(WhatsAppMessage.kind=='cart_reminder')).status=='cancelled'
