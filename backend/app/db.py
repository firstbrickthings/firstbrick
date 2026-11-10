from functools import lru_cache
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from .config import settings


@lru_cache
def engine():
    return create_engine(settings().database_url, pool_pre_ping=True, pool_recycle=1800,
                         pool_size=settings().database_pool_size, isolation_level='READ COMMITTED')


@lru_cache
def sessions():
    return sessionmaker(bind=engine(), expire_on_commit=False)


def database():
    with sessions()() as session:
        yield session
