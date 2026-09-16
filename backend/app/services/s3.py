import logging
from pathlib import Path
from typing import Any

from app.core.config import settings

logger = logging.getLogger(__name__)

_boto3_client: Any = None


def is_s3_enabled() -> bool:
    return bool(
        settings.aws_bucket_name
        and settings.aws_access_key_id
        and settings.aws_secret_access_key
    )


def get_s3_client():
    global _boto3_client
    if _boto3_client is None:
        try:
            import boto3
            from botocore.client import Config
            endpoint_url = f"https://s3.{settings.aws_region}.amazonaws.com"
            _boto3_client = boto3.client(
                "s3",
                aws_access_key_id=settings.aws_access_key_id,
                aws_secret_access_key=settings.aws_secret_access_key,
                region_name=settings.aws_region,
                endpoint_url=endpoint_url,
                config=Config(signature_version="s3v4"),
            )
        except Exception as e:
            logger.error(f"Error inicializando cliente AWS S3: {e}")
            raise
    return _boto3_client


def upload_file_to_s3(local_path: Path, s3_key: str, content_type: str = "video/mp4") -> str:
    """Sube un archivo local al bucket de AWS S3."""
    client = get_s3_client()
    extra_args = {"ContentType": content_type}
    client.upload_file(str(local_path), settings.aws_bucket_name, s3_key, ExtraArgs=extra_args)
    logger.info(f"Archivo subido exitosamente a S3: s3://{settings.aws_bucket_name}/{s3_key}")
    return s3_key


def generate_presigned_url(s3_key: str, expires_in: int = 7200) -> str:
    """Genera una URL prefirmada temporal para streaming o descarga segura desde S3."""
    client = get_s3_client()
    return client.generate_presigned_url(
        "get_object",
        Params={"Bucket": settings.aws_bucket_name, "Key": s3_key},
        ExpiresIn=expires_in,
    )


def object_exists_in_s3(s3_key: str) -> bool:
    """Verifica si un objeto existe en el bucket de S3."""
    if not is_s3_enabled():
        return False
    try:
        client = get_s3_client()
        client.head_object(Bucket=settings.aws_bucket_name, Key=s3_key)
        return True
    except Exception:
        return False


def delete_file_from_s3(s3_key: str) -> None:
    """Elimina un objeto del bucket de S3."""
    if not is_s3_enabled():
        return
    try:
        client = get_s3_client()
        client.delete_object(Bucket=settings.aws_bucket_name, Key=s3_key)
        logger.info(f"Archivo eliminado de S3: s3://{settings.aws_bucket_name}/{s3_key}")
    except Exception as e:
        logger.warning(f"No se pudo eliminar archivo de S3 {s3_key}: {e}")


def download_file_from_s3(s3_key: str, target_path: Path) -> bool:
    """Descarga un objeto de S3 a disco local temporal."""
    if not is_s3_enabled():
        return False
    try:
        client = get_s3_client()
        target_path.parent.mkdir(parents=True, exist_ok=True)
        client.download_file(settings.aws_bucket_name, s3_key, str(target_path))
        return True
    except Exception as e:
        logger.error(f"Error descargando objeto {s3_key} desde S3: {e}")
        return False
