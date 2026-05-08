# app/config.py
import os
import json
import logging
import urllib.parse
from enum import Enum
from datetime import datetime
from dotenv import find_dotenv, load_dotenv
from starlette.middleware.base import BaseHTTPMiddleware


from app.services.vector_store.factory import get_vector_store


load_dotenv(find_dotenv())




class VectorDBType(Enum):
   PGVECTOR = "pgvector"
   ATLAS_MONGO = "atlas-mongo"




def get_env_variable(
   var_name: str, default_value: str = None, required: bool = False
) -> str:
   value = os.getenv(var_name)
   if value is None:
       if default_value is None and required:
           raise ValueError(f"Environment variable '{var_name}' not found.")
       return default_value
   return value




RAG_HOST = os.getenv("RAG_HOST", "0.0.0.0")
RAG_PORT = int(os.getenv("RAG_PORT", 8000))


RAG_UPLOAD_DIR = get_env_variable("RAG_UPLOAD_DIR", "./uploads/")
if not os.path.exists(RAG_UPLOAD_DIR):
   os.makedirs(RAG_UPLOAD_DIR, exist_ok=True)


VECTOR_DB_TYPE = VectorDBType(
   get_env_variable("VECTOR_DB_TYPE", VectorDBType.PGVECTOR.value)
)
POSTGRES_USE_UNIX_SOCKET = (
   get_env_variable("POSTGRES_USE_UNIX_SOCKET", "False").lower() == "true"
)
POSTGRES_DB = get_env_variable("POSTGRES_DB", "mydatabase")
POSTGRES_USER = get_env_variable("POSTGRES_USER", "myuser")
POSTGRES_PASSWORD = get_env_variable("POSTGRES_PASSWORD", "mypassword")
DB_HOST = get_env_variable("DB_HOST", "db")
DB_PORT = get_env_variable("DB_PORT", "5432")
COLLECTION_NAME = get_env_variable("COLLECTION_NAME", "testcollection")
ATLAS_MONGO_DB_URI = get_env_variable(
   "ATLAS_MONGO_DB_URI", "mongodb://127.0.0.1:27018/LibreChat"
)
ATLAS_SEARCH_INDEX = get_env_variable("ATLAS_SEARCH_INDEX", "vector_index")
MONGO_VECTOR_COLLECTION = get_env_variable(
   "MONGO_VECTOR_COLLECTION", None
)  # Deprecated, backwards compatability
CHUNK_SIZE = int(get_env_variable("CHUNK_SIZE", "1500"))
CHUNK_OVERLAP = int(get_env_variable("CHUNK_OVERLAP", "100"))


# Batch processing configuration for memory-constrained environments.
# When EMBEDDING_BATCH_SIZE > 0, documents are processed in batches to reduce
# peak memory usage. This is useful for Kubernetes pods with memory limits.
#
# Trade-offs:
# - Smaller batch size = lower memory, more DB round trips
# - Larger batch size = higher memory, fewer DB round trips
# - 0 = disable batching, process all at once (original behavior)
#
# Recommended: 750 for text-embedding-3-small (good balance of speed and memory)
EMBEDDING_BATCH_SIZE = int(get_env_variable("EMBEDDING_BATCH_SIZE", "0"))


# Maximum number of batches to buffer in memory during async processing.
# Higher values allow more parallelism but use more memory.
EMBEDDING_MAX_QUEUE_SIZE = int(get_env_variable("EMBEDDING_MAX_QUEUE_SIZE", "3"))


env_value = get_env_variable("PDF_EXTRACT_IMAGES", "False").lower()
PDF_EXTRACT_IMAGES = True if env_value == "true" else False


if POSTGRES_USE_UNIX_SOCKET:
   connection_suffix = f"{urllib.parse.quote_plus(POSTGRES_USER)}:{urllib.parse.quote_plus(POSTGRES_PASSWORD)}@/{urllib.parse.quote_plus(POSTGRES_DB)}?host={urllib.parse.quote_plus(DB_HOST)}"
else:
   connection_suffix = f"{urllib.parse.quote_plus(POSTGRES_USER)}:{urllib.parse.quote_plus(POSTGRES_PASSWORD)}@{DB_HOST}:{DB_PORT}/{urllib.parse.quote_plus(POSTGRES_DB)}"


CONNECTION_STRING = f"postgresql+psycopg2://{connection_suffix}"
DSN = f"postgresql://{connection_suffix}"


## Logging


HTTP_RES = "http_res"
HTTP_REQ = "http_req"


logger = logging.getLogger()


debug_mode = os.getenv("DEBUG_RAG_API", "False").lower() in (
   "true",
   "1",
   "yes",
   "y",
   "t",
)
console_json = get_env_variable("CONSOLE_JSON", "False").lower() == "true"


if debug_mode:
   logger.setLevel(logging.DEBUG)
else:
   logger.setLevel(logging.INFO)


if console_json:


   class JsonFormatter(logging.Formatter):
       def __init__(self):
           super(JsonFormatter, self).__init__()


       def format(self, record):
           json_record = {}


           json_record["message"] = record.getMessage()


           if HTTP_REQ in record.__dict__:
               json_record[HTTP_REQ] = record.__dict__[HTTP_REQ]


           if HTTP_RES in record.__dict__:
               json_record[HTTP_RES] = record.__dict__[HTTP_RES]


           if record.levelno == logging.ERROR and record.exc_info:
               json_record["exception"] = self.formatException(record.exc_info)


           timestamp = datetime.fromtimestamp(record.created)
           json_record["timestamp"] = timestamp.isoformat()


           # add level
           json_record["level"] = record.levelname
           json_record["filename"] = record.filename
           json_record["lineno"] = record.lineno
           json_record["funcName"] = record.funcName
           json_record["module"] = record.module
           json_record["threadName"] = record.threadName


           return json.dumps(json_record)


   formatter = JsonFormatter()
else:
   formatter = logging.Formatter(
       "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
   )


handler = logging.StreamHandler()  # or logging.FileHandler("app.log")
handler.setFormatter(formatter)
logger.addHandler(handler)




class LogMiddleware(BaseHTTPMiddleware):
   async def dispatch(self, request, call_next):
       response = await call_next(request)


       logger_method = logger.info


       if str(request.url).endswith("/health"):
           logger_method = logger.debug


       logger_method(
           f"Request {request.method} {request.url} - {response.status_code}",
           extra={
               HTTP_REQ: {"method": request.method, "url": str(request.url)},
               HTTP_RES: {"status_code": response.status_code},
           },
       )


       return response




logging.getLogger("uvicorn.access").disabled = True


## Embeddings


# Hardcoded to use HuggingFace with sentence-transformers/all-MiniLM-L6-v2
from langchain_huggingface import HuggingFaceEmbeddings


EMBEDDINGS_MODEL = "sentence-transformers/all-MiniLM-L6-v2"


embeddings = HuggingFaceEmbeddings(
   model_name=EMBEDDINGS_MODEL,
   encode_kwargs={"normalize_embeddings": True}
)


logger.info(f"Initialized embeddings of type: {type(embeddings)}")


# Vector store
if VECTOR_DB_TYPE == VectorDBType.PGVECTOR:
   vector_store = get_vector_store(
       connection_string=CONNECTION_STRING,
       embeddings=embeddings,
       collection_name=COLLECTION_NAME,
       mode="async",
   )
elif VECTOR_DB_TYPE == VectorDBType.ATLAS_MONGO:
   # Backward compatability check
   if MONGO_VECTOR_COLLECTION:
       logger.info(
           f"DEPRECATED: Please remove env var MONGO_VECTOR_COLLECTION and instead use COLLECTION_NAME and ATLAS_SEARCH_INDEX. You can set both as same, but not neccessary. See README for more information."
       )
       ATLAS_SEARCH_INDEX = MONGO_VECTOR_COLLECTION
       COLLECTION_NAME = MONGO_VECTOR_COLLECTION
   vector_store = get_vector_store(
       connection_string=ATLAS_MONGO_DB_URI,
       embeddings=embeddings,
       collection_name=COLLECTION_NAME,
       mode="atlas-mongo",
       search_index=ATLAS_SEARCH_INDEX,
   )
else:
   raise ValueError(f"Unsupported vector store type: {VECTOR_DB_TYPE}")


retriever = vector_store.as_retriever()


known_source_ext = [
   "go",
   "py",
   "java",
   "sh",
   "bat",
   "ps1",
   "cmd",
   "js",
   "ts",
   "css",
   "cpp",
   "hpp",
   "h",
   "c",
   "cs",
   "sql",
   "log",
   "ini",
   "pl",
   "pm",
   "r",
   "dart",
   "dockerfile",
   "env",
   "php",
   "hs",
   "hsc",
   "lua",
   "nginxconf",
   "conf",
   "m",
   "mm",
   "plsql",
   "perl",
   "rb",
   "rs",
   "db2",
   "scala",
   "bash",
   "swift",
   "vue",
   "svelte",
   "yml",
   "yaml",
   "eml",
   "ex",
   "exs",
   "erl",
   "tsx",
   "jsx",
   "lhs",
]


def init_embeddings(provider: str | None, model: str | None):
    import os
    from langchain.embeddings import OpenAIEmbeddings, HuggingFaceEmbeddings

    provider = (provider or os.getenv("EMBEDDINGS_PROVIDER") or "openai").lower()
    model = model or os.getenv("EMBEDDINGS_MODEL")

    # Prefer OpenAI if explicitly requested and API key present
    if provider == "openai":
        if not os.getenv("OPENAI_API_KEY"):
            print("WARN: OPENAI_API_KEY not set — falling back to HuggingFace embeddings")
            provider = "huggingface"
        else:
            try:
                return OpenAIEmbeddings(model_name=model) if model else OpenAIEmbeddings()
            except Exception as e:
                print("WARN: OpenAIEmbeddings initialization failed:", str(e))
                provider = "huggingface"

    # HuggingFace fallback / default
    if provider == "huggingface":
        model = model or "sentence-transformers/all-MiniLM-L6-v2"
        return HuggingFaceEmbeddings(model_name=model)

    # Last-resort: HuggingFace
    model = model or "sentence-transformers/all-MiniLM-L6-v2"
    return HuggingFaceEmbeddings(model_name=model)



