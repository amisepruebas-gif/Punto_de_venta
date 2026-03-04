package generales_1;

import android.app.Activity;
import android.content.Context;
import android.view.View;
import android.view.inputmethod.InputMethodManager;

import com.google.zxing.integration.android.IntentIntegrator;

import barcodeCamara.MyCaptureActivity;

public class recursos_1 {


    static public void ocultarTeclado(Activity activity) {
        InputMethodManager inputManager = (InputMethodManager) activity.getSystemService(Context.INPUT_METHOD_SERVICE);

        // Obtener la vista que actualmente tiene el foco
        View currentFocusedView = activity.getCurrentFocus();

        if (currentFocusedView != null) {
            inputManager.hideSoftInputFromWindow(currentFocusedView.getWindowToken(), InputMethodManager.HIDE_NOT_ALWAYS);
        }
    }

    static public void photoBarcode(Activity activity){
        IntentIntegrator integrator = new IntentIntegrator(activity);
        integrator.setDesiredBarcodeFormats(IntentIntegrator.ALL_CODE_TYPES);
        integrator.setPrompt("Escanea un código de barras");
        integrator.setCameraId(0);  // Usa la cámara trasera
        integrator.setBeepEnabled(true);
        integrator.setCaptureActivity(MyCaptureActivity.class); // Usa tu actividad personalizada
        integrator.setOrientationLocked(true); // Bloquea la orientación
        integrator.initiateScan();

    }
}
