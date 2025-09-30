import sqlite3
import logging
from datetime import datetime
from contextlib import contextmanager
import threading
import os

logger = logging.getLogger(__name__)

class RequestDatabase:
    """SQLite database for storing color requests"""
    
    def __init__(self, db_path='requests.db'):
        self.db_path = db_path
        self._lock = threading.Lock()  # Thread safety
        self.init_database()
    
    def init_database(self):
        """Initialize the database and create tables if they don't exist"""
        try:
            with self.get_connection() as conn:
                conn.execute('''
                    CREATE TABLE IF NOT EXISTS color_requests (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp TEXT NOT NULL,
                        username TEXT NOT NULL,
                        r INTEGER NOT NULL CHECK(r >= 0 AND r <= 255),
                        g INTEGER NOT NULL CHECK(g >= 0 AND g <= 255),
                        b INTEGER NOT NULL CHECK(b >= 0 AND b <= 255),
                        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                    )
                ''')
                
                # Create indexes for better query performance
                conn.execute('CREATE INDEX IF NOT EXISTS idx_username ON color_requests(username)')
                conn.execute('CREATE INDEX IF NOT EXISTS idx_timestamp ON color_requests(timestamp)')
                
                conn.commit()
                logger.info(f"Database initialized at {self.db_path}")
        except Exception as e:
            logger.error(f"Failed to initialize database: {e}")
            raise
    
    @contextmanager
    def get_connection(self):
        """Context manager for database connections"""
        conn = None
        try:
            conn = sqlite3.connect(self.db_path, timeout=30.0)
            conn.row_factory = sqlite3.Row  # Enable column access by name
            yield conn
        except Exception as e:
            if conn:
                conn.rollback()
            raise e
        finally:
            if conn:
                conn.close()
    
    def log_request(self, username: str, r: int, g: int, b: int) -> int:
        """Log a color request to the database"""
        with self._lock:
            try:
                with self.get_connection() as conn:
                    cursor = conn.execute('''
                        INSERT INTO color_requests 
                        (timestamp, username, r, g, b)
                        VALUES (?, ?, ?, ?, ?)
                    ''', (
                        datetime.now().isoformat(),
                        username,
                        r, g, b
                    ))
                    conn.commit()
                    
                    request_db_id = cursor.lastrowid
                    hex_color = f"#{r:02x}{g:02x}{b:02x}"
                    logger.info(f"Logged request to database: {username} -> {hex_color} (ID: {request_db_id})")
                    return request_db_id
                    
            except Exception as e:
                logger.error(f"Failed to log request to database: {e}")
                raise

    def export_to_csv(self, output_file: str = 'requests_export.csv') -> bool:
        """Export all requests to CSV file"""
        try:
            import csv
            
            with self.get_connection() as conn:
                cursor = conn.execute('''
                    SELECT timestamp, username, r, g, b
                    FROM color_requests 
                    ORDER BY id
                ''')
                
                with open(output_file, 'w', newline='', encoding='utf-8') as csvfile:
                    writer = csv.writer(csvfile)
                    # Write header
                    writer.writerow(['timestamp', 'username', 'r', 'g', 'b'])
                    # Write data
                    writer.writerows(cursor.fetchall())
                
                logger.info(f"Exported requests to {output_file}")
                return True
                
        except Exception as e:
            logger.error(f"Failed to export to CSV: {e}")
            return False

# Global database instance
request_db = None

def init_request_database(db_path='requests.db'):
    """Initialize the global database instance"""
    global request_db
    request_db = RequestDatabase(db_path)
    return request_db

def get_request_database():
    """Get the global database instance"""
    global request_db
    if request_db is None:
        request_db = init_request_database()
    return request_db