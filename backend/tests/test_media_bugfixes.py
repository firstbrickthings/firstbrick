import io
from fastapi import UploadFile
from sqlalchemy import select
from app.db import sessions
from app.models import Category, Product, StoreDocument, StoreSnapshot, MediaFile, Variant
from app.diaper_category_fix import apply_diaper_category_fix, MARKER


def test_move_only_diapers_once_preserving_commerce():
    with sessions()() as db:
        db.add_all([Category(id='bath',name='Bath & Skincare'),Category(id='diaper',name='Diapering')]);db.flush()
        diaper=Product(id='diapers',name='Diapers',category_id='bath',metadata_json={'subcategory':'Diapers'})
        cream=Product(id='cream',name='Diaper cream',category_id='bath',metadata_json={'subcategory':'Diaper Care'})
        db.add_all([diaper,cream,StoreDocument(key='categories',value={'items':[{'id':'bath','name':'Bath & Skincare','subcategories':['Diapers','Diaper Care']},{'id':'diaper','name':'Diapering','subcategories':[]}]},version=1)]);db.flush()
        before=[(v.id,str(v.price),v.stock) for v in db.scalars(select(Variant))]
        apply_diaper_category_fix(db);db.commit()
        assert diaper.category_id=='diaper' and cream.category_id=='bath'
        assert db.get(StoreDocument,'categories').value['items'][0]['subcategories']==['Diaper Care']
        assert db.get(StoreSnapshot,MARKER)
        version=diaper.version
        apply_diaper_category_fix(db);db.commit()
        assert diaper.version==version
        assert before==[(v.id,str(v.price),v.stock) for v in db.scalars(select(Variant))]


def test_large_video_stream_has_no_old_100mb_cutoff(monkeypatch):
    from app import workspace
    class Storage:
        def upload_fileobj(self,file,bucket,key,ExtraArgs):
            assert file.read(12)==b'\0\0\0\x18ftypisom'
    monkeypatch.setattr(workspace,'storage',lambda:Storage())
    video=UploadFile(file=io.BytesIO(b'\0\0\0\x18ftypisom'+b'\0'*32),size=150*1024*1024,filename='120-second-reel.mp4')
    with sessions()() as db:
        result=workspace.upload(video,None,db)
        assert result['size']==150*1024*1024
        assert db.get(MediaFile,result['id']).content_type=='video/mp4'
