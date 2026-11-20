from app.db import sessions
from app.models import Product, Category, Variant
from app.publish_retained_catalog import publish_retained_catalog


def test_enable_only_retained_catalog_without_overwriting_prices_stock_or_later_changes():
    with sessions()() as db:
        db.add(Category(id='bath',name='Bath & Skincare'));db.flush()
        db.add_all([Product(id='care',name='Care',category_id='bath',sale_enabled=False),Product(id='toy',name='Uploaded toy',category_id='feeding',metadata_json={'owner_photo_import':'zip'},sale_enabled=False),Product(id='sample',name='Other template',category_id='feeding',sale_enabled=False)]);db.flush()
        db.add_all([Variant(id='care-v',product_id='care',label='',price=499,stock=0),Variant(id='toy-v',product_id='toy',label='',price=1099,stock=7),Variant(id='sample-v',product_id='sample',label='',price=500,stock=0)]);db.commit()
        publish_retained_catalog(db);db.commit()
        assert db.get(Product,'care').sale_enabled and db.get(Variant,'care-v').stock==10
        assert db.get(Product,'toy').sale_enabled and db.get(Variant,'toy-v').stock==7
        assert db.get(Variant,'care-v').price==499
        assert not db.get(Product,'sample').sale_enabled
        db.get(Variant,'care-v').stock=0;db.get(Product,'care').sale_enabled=False;db.commit()
        publish_retained_catalog(db);db.commit()
        assert db.get(Variant,'care-v').stock==0 and not db.get(Product,'care').sale_enabled
