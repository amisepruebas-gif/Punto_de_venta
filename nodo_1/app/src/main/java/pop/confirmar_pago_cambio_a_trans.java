package pop;

import android.view.Gravity;
import android.view.LayoutInflater;
import android.view.View;
import android.widget.Button;
import android.widget.LinearLayout;
import android.widget.PopupWindow;

import com.example.nodo_1.R;
import com.example.nodo_1.principal;

public class confirmar_pago_cambio_a_trans {
    public void showPopupWindow(final View view, principal principal) {
        LayoutInflater inflater = (LayoutInflater) view.getContext().getSystemService(view.getContext().LAYOUT_INFLATER_SERVICE);
        final View popupView = inflater.inflate(R.layout.conf_cambio_pago_a_trans, null);

        //Specify the length and width through constants
        int width  = LinearLayout.LayoutParams.MATCH_PARENT;
        int height = LinearLayout.LayoutParams.MATCH_PARENT;

        //Make Inactive Items Outside Of PopupWindow
        boolean focusable = true;

        //Create a window with our parameters
        final PopupWindow popupWindow = new PopupWindow(popupView, width, height, focusable);
        popupWindow.showAtLocation(view, Gravity.CENTER, 0, 0);

        Button button = (Button) popupView.findViewById(R.id.button20);
        button.setOnClickListener(new View.OnClickListener() {
            @Override
            public void onClick(View view) {
                principal.consPago_cambio_a_trans();
                popupWindow.dismiss();
            }
        });
    }
}
