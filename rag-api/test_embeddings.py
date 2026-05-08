#!/usr/bin/env python3
"""
Quick test to verify the embeddings are working correctly
Run this script to test the embedding configuration
"""


import sys
sys.path.insert(0, '/Users/abdullah/Downloads/rag_api-main')


print("Testing HuggingFace Embeddings Configuration...")
print("-" * 50)


try:
   from app.config import embeddings, EMBEDDINGS_MODEL
   print(f"✅ Successfully imported embeddings")
   print(f"✅ Model: {EMBEDDINGS_MODEL}")
   print(f"✅ Embeddings Type: {type(embeddings)}")
  
   # Test embedding generation
   print("\nTesting embedding generation...")
   test_text = "This is a test document for RAG API"
   embedding_vector = embeddings.embed_query(test_text)
   print(f"✅ Generated embedding with {len(embedding_vector)} dimensions")
   print(f"✅ Sample values: {embedding_vector[:5]}")
  
   print("\n" + "=" * 50)
   print("✅ ALL TESTS PASSED!")
   print("=" * 50)
   print("\nThe RAG API is now configured to use:")
   print(f"  - Model: {EMBEDDINGS_MODEL}")
   print(f"  - Provider: HuggingFace (Free, No API Key Required)")
   print(f"  - Dimensions: {len(embedding_vector)}")
   print("\nYou can now run the API with: uvicorn main:app")
  
except Exception as e:
   print(f"❌ Error: {e}")
   import traceback
   traceback.print_exc()
   sys.exit(1)



