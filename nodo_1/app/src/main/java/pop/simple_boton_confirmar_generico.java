package pop;

import android.app.Activity;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.PopupWindow;

import com.example.nodo_1.R;

import propiedades_articulos.agregar_tallas_etc;

public class simple_boton_confirmar_generico {
    public void showPopupWindow(final View view, Activity activity) {
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.pop_confirmar_simple_boton_uno, null);

        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);

        if (activity.getClass().getSimpleName().equals("agregar_tallas_etc")){
            ((agregar_tallas_etc)activity).getPopupWindow_confirmar(popupWindow);
            ((agregar_tallas_etc)activity).initPop_confirmar();
        }

        ((Button)popupView.findViewById(R.id.butsimple_pop)).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if (activity.getClass().getSimpleName().equals("agregar_tallas_etc")){
                    ((agregar_tallas_etc)activity).salir_Guardar_Confirmar();
                }
            }
        });
    }
}
