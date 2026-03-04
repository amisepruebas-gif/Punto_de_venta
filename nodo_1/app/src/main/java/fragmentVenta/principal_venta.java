package fragmentVenta;

import android.app.Activity;
import android.content.Intent;
import android.os.Bundle;
import android.view.View;
import android.view.WindowManager;

import androidx.activity.result.ActivityResult;
import androidx.activity.result.ActivityResultCallback;
import androidx.activity.result.ActivityResultLauncher;
import androidx.activity.result.contract.ActivityResultContracts;
import androidx.appcompat.app.AppCompatActivity;
import androidx.fragment.app.Fragment;

import com.example.nodo_1.R;
import com.example.nodo_1.ventas;

public class principal_venta extends AppCompatActivity implements View.OnClickListener {
    Fragment selectedFragment = null;
    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setContentView(R.layout.ventas_v2);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);

        /**INIT**/
        selectedFragment = new por_fecha();
        getSupportFragmentManager().beginTransaction().replace(R.id.fragment_container,
                selectedFragment).commit();
    }

    @Override
    public void onClick(View view) {
        selectedFragment = null;
        if(view.getId() == R.id.button12){
            selectedFragment = new por_fecha();
        } else if (view.getId() == R.id.button18) {
            selectedFragment = new mas_vendidos(selectedFragment);
        }
        if(selectedFragment!=null){
            getSupportFragmentManager().beginTransaction().replace(R.id.fragment_container,
                    selectedFragment).commit();
        }
    }
    ActivityResultLauncher<Intent> someActivityResultLauncher = registerForActivityResult(
            new ActivityResultContracts.StartActivityForResult(),
            new ActivityResultCallback<ActivityResult>() {
                @Override
                public void onActivityResult(ActivityResult result) {
                    if (result.getResultCode() == Activity.RESULT_OK) {

                    }
                }
            });
}
