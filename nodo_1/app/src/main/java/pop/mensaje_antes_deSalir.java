package pop;

import android.app.Activity;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.PopupWindow;


import com.example.nodo_1.R;

import propiedades_articulos.generarDescuento;
import propiedades_articulos.mayoreo_articulos;
import propiedades_articulos.seña;
import propiedades_articulos.tres_x_n;

public class mensaje_antes_deSalir {

    public void showPopupWindow(final View view, Activity activity) {
        LayoutInflater inflater = LayoutInflater.from(view.getContext());
        final View popupView = inflater.inflate(R.layout.dialog_custom, null);


        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        PopupWindow popupWindow;
        //Create a window with our parameters
        popupWindow = new PopupWindow(popupView, width, height, focusable);
        if (activity.getClass().getSimpleName().equals("mayoreo_articulos")){
            ((mayoreo_articulos)activity).getPopupWindow(popupWindow);
            ((mayoreo_articulos)activity).initPop();
        } else if (activity.getClass().getSimpleName().equals("generarDescuento")){
            ((generarDescuento)activity).getPopupWindow(popupWindow);
            ((generarDescuento)activity).initPop();
        } else if (activity.getClass().getSimpleName().equals("tres_x_n")){
            ((tres_x_n)activity).getPopupWindow(popupWindow);
            ((tres_x_n)activity).initPop();
        }  else if (activity.getClass().getSimpleName().equals("seña")){
            ((seña)activity).getPopupWindow(popupWindow);
            ((seña)activity).initPop();
        }
        //Set the location of the window on the screen
        popupWindow.showAtLocation(popupView, Gravity.CENTER, 0, 0);
        // Referenciar los elementos del layout
        Button btnConfirmar = popupView.findViewById(R.id.btnConfirmar);

        // Configurar la acción del botón
        btnConfirmar.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                popupWindow.dismiss(); // Cerrar el diálogo
                if (activity.getClass().getSimpleName().equals("mayoreo_articulos")){((mayoreo_articulos)activity).finishclass();}
                else if (activity.getClass().getSimpleName().equals("generarDescuento")){(( generarDescuento)activity).finishclass();}
                else if (activity.getClass().getSimpleName().equals("tres_x_n")){(( tres_x_n)activity) .finishclass();}
                else if (activity.getClass().getSimpleName().equals("seña")){(( seña)activity) .finishclass();}
            }
        });
    }
}
