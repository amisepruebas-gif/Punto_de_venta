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
import propiedades_articulos.tres_x_n;

public class popBotonConfirmarDescuento {
    public void showPopupWindow(final View view, Activity activity) {
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.pop_simple_boton, null);

        //Specify the length and width through constants
        int width = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);

        //Set the location of the window on the screen
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);

        if (activity.getClass().getSimpleName().equals("generarDescuento")){
            ((propiedades_articulos.generarDescuento)activity).getPopupWindow_confirmar(popupWindow);
            ((propiedades_articulos.generarDescuento)activity).initPop_confirmar();
        }  else if (activity.getClass().getSimpleName().equals("mayoreo_articulos")){
            ((mayoreo_articulos)activity).getPopupWindow_confirmar(popupWindow);
            ((mayoreo_articulos)activity).initPop_confirmar();
        }  else if (activity.getClass().getSimpleName().equals("tres_x_n")){
            ((tres_x_n)activity).getPopupWindow_confirmar(popupWindow);
            ((tres_x_n)activity).initPop_confirmar();
        }

        ((Button)popupView.findViewById(R.id.button189)).setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view)
            {
                if (activity.getClass().getSimpleName().equals("generarDescuento")){
                    ((generarDescuento)activity).subirDatos();
                }  else if (activity.getClass().getSimpleName().equals("mayoreo_articulos")){
                    ((mayoreo_articulos)activity).subirDatos();
                } else if (activity.getClass().getSimpleName().equals("tres_x_n")){
                    ((tres_x_n)activity).subirDatos();
                }
                popupWindow.dismiss();
            }
        });

    }
}
