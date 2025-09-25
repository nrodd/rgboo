import os

class Config:
    """Configuration settings for the middleware API"""
    
    # Flask settings
    HOST = os.getenv('HOST', '127.0.0.1')  # localhost
    PORT = int(os.getenv('PORT', 5000))
    DEBUG = os.getenv('DEBUG', 'True').lower() == 'true'
    
    # Serial communication settings
    SERIAL_BAUD_RATE = int(os.getenv('SERIAL_BAUD_RATE', 115200))
    SERIAL_TIMEOUT = int(os.getenv('SERIAL_TIMEOUT', 2))
    
    # Logging settings
    LOG_LEVEL = os.getenv('LOG_LEVEL', 'INFO')
    LOG_FILE = os.getenv('LOG_FILE', 'middleware.log')
    
    # API settings
    MAX_USERNAME_LENGTH = int(os.getenv('MAX_USERNAME_LENGTH', 50))
    ENABLE_CORS = os.getenv('ENABLE_CORS', 'True').lower() == 'true'
    
    # ESP32 connection settings
    AUTO_RECONNECT = os.getenv('AUTO_RECONNECT', 'True').lower() == 'true'
    CONNECTION_RETRY_DELAY = int(os.getenv('CONNECTION_RETRY_DELAY', 5))
    
    @classmethod
    def get_all_settings(cls):
        """Return all configuration settings as a dictionary"""
        return {
            'HOST': cls.HOST,
            'PORT': cls.PORT,
            'DEBUG': cls.DEBUG,
            'SERIAL_BAUD_RATE': cls.SERIAL_BAUD_RATE,
            'SERIAL_TIMEOUT': cls.SERIAL_TIMEOUT,
            'LOG_LEVEL': cls.LOG_LEVEL,
            'LOG_FILE': cls.LOG_FILE,
            'MAX_USERNAME_LENGTH': cls.MAX_USERNAME_LENGTH,
            'ENABLE_CORS': cls.ENABLE_CORS,
            'AUTO_RECONNECT': cls.AUTO_RECONNECT,
            'CONNECTION_RETRY_DELAY': cls.CONNECTION_RETRY_DELAY
        }