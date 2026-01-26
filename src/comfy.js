import axios from 'axios';

const COMFY_URL = "http://127.0.0.1:8188";

// ==========================================
// WORKFLOW 1: TEXT-TO-IMAGE (Flux SCHNELL)
// ==========================================
const fluxWorkflow = (userPrompt, negativePrompt = "") => {
  return {
    // 1. UNET LOADER
    "3": {
      "inputs": {
        // Ensure this filename matches your file in models/unet/
        "unet_name": "flux1-schnell-Q4_K_S.gguf" 
      },
      "class_type": "UnetLoaderGGUF"
    },
    // 2. VAE LOADER
    "4": {
      "inputs": {
        "vae_name": "ae((black-forest-labs)FLUX1-schnell).safetensors"
      },
      "class_type": "VAELoader"
    },
    // 3. CLIP LOADER
    "13": {
      "inputs": {
        "clip_name1": "t5xxl_fp8_e4m3fn(Text Encoder 1).safetensors",
        "clip_name2": "clip_l(Text Encoder 2).safetensors",
        "type": "flux"
      },
      "class_type": "DualCLIPLoader"
    },
    // 4. POSITIVE PROMPT
    "5": {
      "inputs": {
        "text": userPrompt,
        "clip": ["13", 0]
      },
      "class_type": "CLIPTextEncode"
    },
    // 5. NEGATIVE PROMPT
    "7": {
      "inputs": {
        "text": negativePrompt || "low quality, bad anatomy",
        "clip": ["13", 0]
      },
      "class_type": "CLIPTextEncode"
    },
    // 6. EMPTY IMAGE (Canvas)
    "8": {
      "inputs": { 
        "width": 896,   // Reduced from 1024 to prevent OOM
        "height": 896,  // Reduced from 1024 to prevent OOM
        "batch_size": 1 
      },
      "class_type": "EmptyLatentImage"
    },
    // 7. KSAMPLER
    "9": {
      "inputs": {
        "seed": Math.floor(Math.random() * 10000000000),
        "steps": 4,           // Schnell Speed
        "cfg": 1.0,           // Schnell Standard
        "sampler_name": "euler",
        "scheduler": "simple",
        "denoise": 1,
        "model": ["3", 0],    // Direct connection to UNET (No LoRA)
        "positive": ["5", 0],
        "negative": ["7", 0],
        "latent_image": ["8", 0]
      },
      "class_type": "KSampler"
    },
    // 8. SAVE
    "10": { "inputs": { "samples": ["9", 0], "vae": ["4", 0] }, "class_type": "VAEDecode" },
    "11": { "inputs": { "filename_prefix": "Sol_Gen", "images": ["10", 0] }, "class_type": "SaveImage" }
  };
};

// ==========================================
// WORKFLOW 2: FLORENCE INPAINTING (Edit Mode)
// ==========================================
const editWorkflow = (filename, selectionPrompt, genPrompt) => {
  return {
    // 1. LOAD IMAGE
    "17": {
      "inputs": {
        "image": filename, // File must be in ComfyUI/input/
        "upload": "image"
      },
      "class_type": "LoadImage"
    },
    
    // 2. FLORENCE-2 MODEL LOADER
    "19": {
      "inputs": {
        "model": "Florence-2-base-ft",
        "precision": "fp16",
        "attention": "sdpa"
      },
      "class_type": "Florence2ModelLoader"
    },

    // 3. FLORENCE-2 RUN (Selector)
    "20": {
      "inputs": {
        "image": ["17", 0],
        "text_input": selectionPrompt, 
        "task": "referring_expression_segmentation",
        "florence2_model": ["19", 0]
      },
      "class_type": "Florence2Run"
    },

    // 4. VAE ENCODE FOR INPAINT (Masking)
    "18": {
      "inputs": {
        "pixels": ["17", 0],
        "vae": ["4", 0],
        "mask": ["20", 1], 
        "grow_mask_by": 6
      },
      "class_type": "VAEEncodeForInpaint"
    },

    // --- FLUX SCHNELL SETUP ---
    "3": { 
        "inputs": { "unet_name": "flux1-schnell-Q4_K_S.gguf" }, 
        "class_type": "UnetLoaderGGUF" 
    },
    "4": { "inputs": { "vae_name": "ae((black-forest-labs)FLUX1-schnell).safetensors" }, "class_type": "VAELoader" },
    "13": { "inputs": { "clip_name1": "t5xxl_fp8_e4m3fn(Text Encoder 1).safetensors", "clip_name2": "clip_l(Text Encoder 2).safetensors", "type": "flux" }, "class_type": "DualCLIPLoader" },

    // 5. PROMPTS
    "5": {
      "inputs": {
        "text": genPrompt,
        "clip": ["13", 0]
      },
      "class_type": "CLIPTextEncode"
    },
    "7": {
      "inputs": { "text": "low quality, blurry", "clip": ["13", 0] },
      "class_type": "CLIPTextEncode"
    },

    // 6. KSAMPLER (No LoRA)
    "9": {
      "inputs": {
        "seed": Math.floor(Math.random() * 10000000000),
        "steps": 4,           // Schnell Speed
        "cfg": 1.0,
        "sampler_name": "euler",
        "scheduler": "simple",
        "denoise": 1.0,       // High denoise for full replacement
        "model": ["3", 0],    // Direct connection to UNET (No LoRA)
        "positive": ["5", 0],
        "negative": ["7", 0],
        "latent_image": ["18", 0] 
      },
      "class_type": "KSampler"
    },

    // 7. SAVE
    "10": { "inputs": { "samples": ["9", 0], "vae": ["4", 0] }, "class_type": "VAEDecode" },
    "11": { "inputs": { "filename_prefix": "Sol_Edit", "images": ["10", 0] }, "class_type": "SaveImage" }
  };
};

// ==========================================
// MAIN TRIGGER FUNCTION
// ==========================================
export const generateImage = async (promptData) => {
  try {
    let workflow;

    // DETECT MODE: Is this an Edit or a Generation?
    if (promptData.type === 'edit') {
        workflow = editWorkflow(promptData.filename, promptData.selection, promptData.prompt);
    } else {
        workflow = fluxWorkflow(promptData.prompt, promptData.negative);
    }
    
    // Send to ComfyUI
    const queueResp = await axios.post(`${COMFY_URL}/prompt`, { prompt: workflow });
    const promptId = queueResp.data.prompt_id;

    // Wait for Image
    return new Promise((resolve, reject) => {
      const interval = setInterval(async () => {
        try {
          const historyResp = await axios.get(`${COMFY_URL}/history/${promptId}`);
          const history = historyResp.data[promptId];

          if (history && history.outputs) {
            clearInterval(interval);
            const outputNode = history.outputs["11"];
            if (outputNode && outputNode.images) {
                const images = outputNode.images;
                const filename = images[0].filename;
                const subfolder = images[0].subfolder;
                const type = images[0].type;
                const imageUrl = `${COMFY_URL}/view?filename=${filename}&subfolder=${subfolder}&type=${type}`;
                resolve(imageUrl);
            }
          }
        } catch (e) { /* waiting */ }
      }, 1000);
    });
  } catch (error) {
    console.error("ComfyUI Error:", error);
    return null;
  }
};