"""Create missing tables from the current application metadata.

This compatibility baseline can also adopt an existing installation: it creates
only absent tables and never drops or rewrites existing inventory data.
"""
from alembic import op

from app.models import Base

revision = "0001_initial"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    Base.metadata.create_all(bind=op.get_bind(), checkfirst=True)


def downgrade() -> None:
    pass
