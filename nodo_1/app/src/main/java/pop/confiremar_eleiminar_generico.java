package pop;

import android.app.Activity;
import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.PopupWindow;


import com.example.nodo_1.R;

import propiedades_articulos.tallas;

public class confiremar_eleiminar_generico {
    public void showPopupWindow(final View view, Activity activity) {
        LayoutInflater inflater = LayoutInflater.from(view.getContext());
        final View popupView = inflater.inflate(R.layout.pop_confirmar_simple_boton_uno, null);


        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        PopupWindow popupWindow;
        //Create a window with our parameters
        Button button = (Button) popupView.findViewById(R.id.butsimple_pop);

        popupWindow = new PopupWindow(popupView, width, height, focusable);
        if (activity.getClass().getSimpleName().equals("tallas")){
            ((tallas)activity).getPopupWindow(popupWindow);
            ((tallas)activity).initPop();
            button.setText("ELIMINAR GRUPO");
        }
        //Set the location of the window on the screen
        popupWindow.showAtLocation(popupView, Gravity.CENTER, 0, 0);

        button.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                if (activity.getClass().getSimpleName().equals("tallas")){
                    ((tallas)activity).remove();
                }
                popupWindow.dismiss();
            }
        });

    }
}























