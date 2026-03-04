package propiedades_articulos;


import static com.example.nodo_1.generales.toast;

import android.app.Activity;
import android.content.Intent;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowInsetsController;
import android.view.WindowManager;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;

import com.example.nodo_1.R;
import com.sothree.slidinguppanel.SlidingUpPanelLayout;

public class editar_propiedades extends AppCompatActivity implements View.OnClickListener {

    public SlidingUpPanelLayout sliding;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.editar_propiedades);
        //sliding = (SlidingUpPanelLayout) findViewById(R.id.panelState_EquipoTrabajo);
        initPantalla();
    }


    private void initPantalla(){
        Window window = getWindow();
        window.clearFlags(WindowManager.LayoutParams.FLAG_TRANSLUCENT_STATUS);
        window.addFlags(WindowManager.LayoutParams.FLAG_DRAWS_SYSTEM_BAR_BACKGROUNDS);
        window.setStatusBarColor(getResources().getColor(R.color.blanco)); // Asegúrate de que el color esté definido en tus recursos.

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
            WindowInsetsController insetsController = window.getInsetsController();
            if (insetsController != null) {
                insetsController.setSystemBarsAppearance(WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS, WindowInsetsController.APPEARANCE_LIGHT_STATUS_BARS);
            }
        } else if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            View decor = window.getDecorView();
            decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR);
        }
    }

    @Override
    public void onClick(View view) {
        if (R.id.but_descuento == view.getId()){
            Intent askIntent = new Intent(this, generarDescuento.class);
            someActivityResultLauncher.launch(askIntent);
        }else if (R.id.but_mayoreo == view.getId()){
            Intent askIntent = new Intent(this, mayoreo_articulos.class);
            someActivityResultLauncher.launch(askIntent);
        } else if (R.id.but_3_x_n == view.getId()) {
            Intent askIntent = new Intent(this, tres_x_n.class);
            someActivityResultLauncher.launch(askIntent);
        } else if (R.id.but_tallas == view.getId()) {
            Intent askIntent = new Intent(this, tallas.class);
            someActivityResultLauncher.launch(askIntent);
        } else if(R.id.but_seña == view.getId()){
            Intent askIntent = new Intent(this, seña.class);
            someActivityResultLauncher.launch(askIntent);
        }
    }


    ActivityResultLauncher<Intent> someActivityResultLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            new ActivityResultCallback<ActivityResult>() {
                @Override
                public void onActivityResult(ActivityResult result) {
                    if (result.getResultCode() == Activity.RESULT_OK) {
                        // There are no request codes
                        Intent data = result.getData();

                        if(data != null){
                            if(data.hasExtra("registroExitoso"))
                            {

                            }
                        }else toast("EQUIPO NO REGISTRADO, ERROR", getApplicationContext());
                    }
                }
            });
}
