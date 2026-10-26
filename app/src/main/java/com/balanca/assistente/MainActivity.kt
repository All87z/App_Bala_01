package com.balanca.assistente

import android.Manifest
import android.content.pm.PackageManager
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.activity.viewModels
import androidx.core.content.ContextCompat
import com.balanca.assistente.ui.ProductViewModel
import com.balanca.assistente.ui.ScaleAssistantApp
import com.balanca.assistente.ui.theme.AssistenteDeBalancaTheme

class MainActivity : ComponentActivity() {

    private val viewModel: ProductViewModel by viewModels()

    private val requestAudioPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { isGranted ->
        if (isGranted) {
            viewModel.startVoiceRecognition(this)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        setContent {
            AssistenteDeBalancaTheme {
                ScaleAssistantApp(
                    viewModel = viewModel,
                    onRequestMicrophonePermission = {
                        val permission = Manifest.permission.RECORD_AUDIO
                        if (ContextCompat.checkSelfPermission(this, permission) != PackageManager.PERMISSION_GRANTED) {
                            requestAudioPermissionLauncher.launch(permission)
                        } else {
                            viewModel.startVoiceRecognition(this)
                        }
                    }
                )
            }
        }
    }

    override fun onResume() {
        super.onResume()
        viewModel.triggerAutoSync(this)
    }
}
